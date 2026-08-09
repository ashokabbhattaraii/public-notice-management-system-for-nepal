#!/usr/bin/env python3
"""Export BAAI/bge-reranker-v2-m3 to an int8-quantized ONNX model.

Why: the fp32 PyTorch checkpoint is ~2.2 GB and ~800 MB+ resident. The int8
ONNX export of the same model (same XLM-R XLM-RoBERTa weights — same 100+
language coverage including Nepali/Devanagari) shrinks the transform weights
~4x (the embedding lookup tables stay fp32 — they are Gather constants and
cannot be dynamically quantized) and runs 3-5x faster per query on CPU.

This is a BUILD-TIME step. The deployment bakes the produced directory into
the container image or runs this once on the host; production must not hit
HuggingFace on every container start.

Recipe notes (torch 2.12 / onnx 1.22 / onnxruntime 1.27):
  - torch's ONNX exporter emits stale graph-annotation (value_info) for
    XLM-R sized models, which fails onnxruntime's mandatory shape inference
    during quantization with "[ShapeInferenceError] ... (1024) vs (1)".
    Fix: strip graph.value_info, re-save with external data, then run
    onnx.shape_inference.infer_shapes_path before quantize_dynamic.
  - quantize_dynamic() with MatMulConstBOnly=False so every MatMul weights are
    int8, not only those with constant second operands.

Usage:
    python scripts/export_reranker_onnx.py               # -> models/bge-reranker-v2-m3-int8/
    python scripts/export_reranker_onnx.py --hf-model cross-encoder/mmarco-mMiniLMv2-L12-H384-v1

Build deps: torch, transformers, onnx, onnxruntime (all present in venv).
Runtime deps of the produced model: onnxruntime, transformers tokenizer.
"""

import argparse
import time
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL = "BAAI/bge-reranker-v2-m3"
DEFAULT_OUT = ROOT / "models" / "bge-reranker-v2-m3-int8"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hf-model", default=DEFAULT_MODEL)
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT))
    parser.add_argument(
        "--exclude-nodes",
        default="",
        help="comma-separated node names to leave in fp32 during quantization",
    )
    args = parser.parse_args()
    excluded = {n.strip() for n in args.exclude_nodes.split(",") if n.strip()}

    import onnx
    from onnxruntime.quantization import QuantType, quantize_dynamic
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    t0 = time.perf_counter()
    print(f"[1/4] Loading {args.hf_model} (from cache if present)...", flush=True)
    tokenizer = AutoTokenizer.from_pretrained(args.hf_model)
    model = AutoModelForSequenceClassification.from_pretrained(args.hf_model)
    model.eval()

    # XLM-R cross-encoder: one sequence (query + ["</s>"] + passage), no
    # token_type_ids. Dummy pair at 64 tokens keeps export cheap; dynamic axes
    # allow runtime batch/sequence freedom.
    dummy = tokenizer(
        "exam notice deadline",
        "परीक्षा सूचना म्याद",
        padding="max_length",
        truncation=True,
        max_length=64,
        return_tensors="pt",
    )
    raw_path = out_dir / "model.onnx"

    print("[2/4] Exporting to ONNX...", flush=True)
    torch.onnx.export(
        model,
        (dummy["input_ids"], dummy["attention_mask"]),
        raw_path,
        input_names=["input_ids", "attention_mask"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "seq"},
            "attention_mask": {0: "batch", 1: "seq"},
            "logits": {0: "batch", 1: "seq"},
        },
        opset_version=17,
        do_constant_folding=True,
    )

    print("[3/4] Stripping graph annotation + shape inference...", flush=True)
    model_proto = onnx.load(str(raw_path), load_external_data=True)
    del model_proto.graph.value_info[:]
    clean_path = out_dir / "clean.onnx"
    onnx.save_model(
        model_proto,
        str(clean_path),
        save_as_external_data=True,
        all_tensors_to_one_file=True,
        location="clean.onnx.data",
        size_threshold=1024,
        convert_attribute=False,
    )
    model_proto = None
    onnx.shape_inference.infer_shapes_path(str(clean_path), str(clean_path))
    print(f"    shape inference passed in {time.perf_counter() - t0:.1f}s", flush=True)

    print("[4/4] Quantizing to int8 (dynamic, MatMul/Add/Gemm)...", flush=True)
    # ONLY constant-B MatMuls get quantized (MatMulConstBOnly=True, the
    # onnxruntime default). Quantizing the dynamic-B attention matmuls
    # (Q·Kᵀ, attn·V) with per_channel=True produces DynamicQuantizeMatMul
    # nodes that fail "matmul dimension mismatch" at batch>1 on CPU
    # (microsoft/onnxruntime#25489, #18692). per_channel=False is likewise
    # required on exports whose attention weights are 3D initializers.
    quant_path = out_dir / "model_int8.onnx"
    quantize_dynamic(
        str(clean_path),
        str(quant_path),
        weight_type=QuantType.QInt8,
        op_types_to_quantize=["MatMul", "Add", "Gemm"],
        per_channel=False,
        reduce_range=True,
        nodes_to_exclude=excluded or None,
        extra_options={"MatMulConstBOnly": True},
    )
    for stale in ("model.onnx", "model.onnx.data", "clean.onnx", "clean.onnx.data"):
        (out_dir / stale).unlink(missing_ok=True)

    tokenizer.save_pretrained(out_dir)
    size_mb = sum(p.stat().st_size for p in out_dir.rglob("*")) / (1024 * 1024)
    print(
        f"Done in {time.perf_counter() - t0:.0f}s → {out_dir} "
        f"({size_mb / 1024:.2f} GB on disk)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())