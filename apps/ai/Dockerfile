# ---------- Base ----------
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

# Runtime libraries needed by OCR/PDF/image processing.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgl1 \
        libgomp1 \
        poppler-utils \
        tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# ---------- Dependencies ----------
FROM base AS deps

COPY apps/ai/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir --upgrade pip

# This server has no GPU.
# Install the CPU-only PyTorch build instead of pulling CUDA/NVIDIA packages.
RUN pip install --no-cache-dir \
    torch \
    --index-url https://download.pytorch.org/whl/cpu

# Install the remaining AI dependencies.
RUN pip install --no-cache-dir \
    -r requirements.txt

# ---------- Production ----------
FROM base AS runner

# Copy installed Python packages and executables.
COPY --from=deps /usr/local/lib/python3.11/site-packages \
    /usr/local/lib/python3.11/site-packages

COPY --from=deps /usr/local/bin \
    /usr/local/bin

# Application code.
COPY apps/ai/app ./app

# Runtime directories.
RUN mkdir -p /app/data/uploads /app/models

EXPOSE 8000

# One worker is intentional:
# this server has only 2 vCPU / ~1 GB RAM and the embedding
# models are loaded into process memory.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]