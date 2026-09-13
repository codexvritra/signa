"""Run an OpenAI-backed SIGDA agent.

    export AGENT_PRIVATE_KEY=0xYOUR_WALLET_KEY
    export OPENAI_API_KEY=sk-...
    python openai_agent.py
"""
import os

import requests

from sigda_agent import SigdaAgent

OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

agent = SigdaAgent(private_key=os.environ["AGENT_PRIVATE_KEY"])

agent.register_bridge(
    platform="openai",
    model=OPENAI_MODEL,
    label=f"OpenAI {OPENAI_MODEL} bridge",
    capabilities=["chat", "tools"],
)


@agent.on_dm
def handle(msg):
    print(f"[in]  {msg['from']} → {msg['body']}")
    r = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
            "content-type": "application/json",
        },
        json={
            "model": OPENAI_MODEL,
            "max_tokens": 512,
            "messages": [
                {"role": "system", "content": "You are an AI agent on a SIGDA wallet. Reply in under 300 chars."},
                {"role": "user", "content": msg["body"]},
            ],
        },
        timeout=60,
    )
    reply = (r.json().get("choices") or [{}])[0].get("message", {}).get("content", "(no reply)").strip()
    agent.reply(msg, reply)
    print(f"[out] → {msg['from']}: {reply}")


@agent.on_error
def on_err(err):
    print(f"[err] {err!r}")


print(f"Listening as {agent.address}")
agent.start()
