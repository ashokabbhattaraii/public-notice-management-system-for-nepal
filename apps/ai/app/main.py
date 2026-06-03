import json
from urllib.parse import parse_qs


async def app(scope, receive, send):
    if scope["type"] == "lifespan":
        message = await receive()
        if message["type"] == "lifespan.startup":
            await send({"type": "lifespan.startup.complete"})
        message = await receive()
        if message["type"] == "lifespan.shutdown":
            await send({"type": "lifespan.shutdown.complete"})
        return

    assert scope["type"] == "http"

    path = scope["path"]
    method = scope["method"]

    if method == "GET" and path == "/":
        await json_response(send, {"service": "pnm-ai", "status": "running"})
    elif method == "GET" and path == "/health":
        await json_response(send, {"status": "healthy"})
    elif method == "GET" and path == "/documents":
        await json_response(send, {"documents": []})
    elif method == "POST" and path == "/documents":
        body = await read_body(receive)
        await json_response(send, {"message": "Document received", "data": body}, status=201)
    elif method == "POST" and path == "/query":
        body = await read_body(receive)
        question = body.get("question", "")
        await json_response(send, {
            "question": question,
            "answer": "",
            "sources": [],
        })
    else:
        await json_response(send, {"error": "Not found"}, status=404)


async def read_body(receive):
    body = b""
    more_body = True
    while more_body:
        message = await receive()
        body += message.get("body", b"")
        more_body = message.get("more_body", False)
    try:
        return json.loads(body) if body else {}
    except json.JSONDecodeError:
        return {}


async def json_response(send, data, status=200):
    body = json.dumps(data).encode("utf-8")
    await send({
        "type": "http.response.start",
        "status": status,
        "headers": [
            [b"content-type", b"application/json"],
            [b"access-control-allow-origin", b"*"],
            [b"access-control-allow-methods", b"GET, POST, OPTIONS"],
            [b"access-control-allow-headers", b"content-type"],
        ],
    })
    await send({
        "type": "http.response.body",
        "body": body,
    })
