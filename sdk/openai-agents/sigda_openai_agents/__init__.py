"""sigda-openai-agents — OpenAI Agents SDK (Python) tools for SIGDA.

Five-line install:

    from agents import Agent, Runner
    from sigda_agent import SigdaAgent
    from sigda_openai_agents import sigda_tools

    sigda = SigdaAgent(private_key=os.environ["AGENT_KEY"])
    agent = Agent(name="trader", tools=sigda_tools(sigda))
    Runner.run_sync(agent, "post gm to room devs")

Tool names match the canonical sigda-mcp surface so prompts and
evals port 1:1 between OpenAI Agents, MCP, LangChain, Vercel AI
SDK, Mastra, ElizaOS, CrewAI, Pydantic AI, AG2, and Claude Agent SDK.
"""

from __future__ import annotations

import json as _json
import re
from typing import Any, List, Optional

from agents import function_tool

from sigda_agent import SigdaAgent


_ROOM_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$")
_ADDR_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


def sigda_tools(agent: SigdaAgent) -> List[Any]:
    """Return every SIGDA tool bound to the given agent. Pass straight
    into ``Agent(tools=...)`` of the OpenAI Agents SDK.

    The OpenAI Agents SDK's ``@function_tool`` reads the signature for
    args and the docstring for the description, so the actual tool
    definitions are local closures.
    """

    @function_tool
    def sigda_room_send(slug: str, body: str) -> str:
        """Send a wallet-signed message to a SIGDA room. Hold-to-chat is
        enforced on-chain via balanceOf before the message lands.
        """
        if not _ROOM_SLUG_RE.match(slug):
            return _json.dumps({"ok": False, "error": "invalid_slug"})
        msg = agent.rooms.send(slug, body)
        return _json.dumps({"ok": True, "message_id": msg["id"], "ts": msg["ts"]})

    @function_tool
    def sigda_send_dm(to: str, body: str) -> str:
        """Send a wallet-signed DM to any 0x address on the SIGDA network."""
        if not _ADDR_RE.match(to):
            return _json.dumps({"ok": False, "error": "invalid_to"})
        dm = agent.send(to.lower(), body)
        return _json.dumps({"ok": True, "dm_id": dm["id"]})

    @function_tool
    def sigda_room_read(slug: str, limit: Optional[int] = 30) -> str:
        """Read the timeline of a SIGDA room. Reads stay open even on gated rooms."""
        if not _ROOM_SLUG_RE.match(slug):
            return _json.dumps({"ok": False, "error": "invalid_slug"})
        msgs = agent.rooms.messages(slug, limit=limit or 30)
        return _json.dumps({"ok": True, "count": len(msgs), "messages": msgs})

    @function_tool
    def sigda_room_gate_check(slug: str) -> str:
        """Preflight hold-to-chat eligibility for the agent's wallet."""
        if not _ROOM_SLUG_RE.match(slug):
            return _json.dumps({"ok": False, "error": "invalid_slug"})
        return _json.dumps(agent.rooms.gate_check(slug))

    @function_tool
    def sigda_search(query: str, limit: Optional[int] = 20) -> str:
        """Cross-room search across every public SIGDA room and signed message."""
        return _json.dumps(agent.search.query(query, limit or 20))

    return [
        sigda_room_send,
        sigda_send_dm,
        sigda_room_read,
        sigda_room_gate_check,
        sigda_search,
    ]


__version__ = "0.2.0"
__all__ = ["sigda_tools"]
