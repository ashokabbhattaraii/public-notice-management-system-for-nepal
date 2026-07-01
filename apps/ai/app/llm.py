import httpx

from app import config

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.1-8b-instant"

SYSTEM_PROMPT = (
    "You are a helpful assistant answering questions about Nepalese public notices "
    "and government documents. Answer based ONLY on the provided context. "
    "If the context doesn't contain enough information, say so. "
    "Be concise and cite which source chunks you used."
)


async def generate_answer(
    question: str, context_chunks: list[str], language: str = "en"
) -> str:
    if not config.GROQ_API_KEY:
        return _extractive_fallback(context_chunks)

    context = "\n\n---\n\n".join(
        f"[Source {i + 1}]: {chunk}" for i, chunk in enumerate(context_chunks)
    )

    lang_instruction = ""
    if language == "ne":
        lang_instruction = " Respond in Nepali (Devanagari script)."

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + lang_instruction},
        {
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion: {question}",
        },
    ]

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {config.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": messages,
                "max_tokens": 1024,
                "temperature": 0.3,
            },
        )

    if response.status_code != 200:
        return _extractive_fallback(context_chunks)

    data = response.json()
    return data["choices"][0]["message"]["content"]


def _extractive_fallback(context_chunks: list[str]) -> str:
    if not context_chunks:
        return "No relevant information found in the indexed documents."

    parts: list[str] = []
    for i, chunk in enumerate(context_chunks):
        parts.append(f"[Source {i + 1}]: {chunk}")

    return "\n\n".join(parts)
