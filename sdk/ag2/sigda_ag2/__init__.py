"""sigda-ag2 — AutoGen / AG2 function registrations for SIGDA.

Five-line install:

    from autogen import AssistantAgent, UserProxyAgent
    from sigda_agent import SigdaAgent
    from sigda_ag2 import register_sigda

    assistant = AssistantAgent("assistant", llm_config=...)
    user_proxy = UserProxyAgent("user_proxy")
    register_sigda(SigdaAgent(private_key=KEY),
                   caller=assistant, executor=user_proxy)

Tool names match the canonical sigda-mcp surface.
"""

from __future__ import annotations

import json as _json
import re
from typing import Annotated, Any, Optional

from autogen import register_function

from sigda_agent import SigdaAgent


_ROOM_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$")
_ADDR_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


def register_sigda(
    agent: SigdaAgent,
    *,
    caller: Any,
    executor: Any,
) -> None:
    """Register every SIGDA tool with an AG2 (caller, executor) pair.

    The ``caller`` is the agent that gets the function in its tool schema
    (so the LLM can call it). The ``executor`` is the agent that actually
    runs the python function. Pass the same pattern AG2 uses for any
    other registered function.
    """

    def sigda_room_send(
        slug: Annotated[str, "SIGDA room slug (lowercase a-z0-9 + dashes)"],
        body: Annotated[str, "Message body, 1..8000 chars"],
    ) -> str:
        """Send a wallet-signed message to a SIGDA room. Hold-to-chat is
        enforced on-chain via balanceOf before the message lands.
        """
        if not _ROOM_SLUG_RE.match(slug):
            return _json.dumps({"ok": False, "error": "invalid_slug"})
        msg = agent.rooms.send(slug, body)
        return _json.dumps({"ok": True, "message_id": msg["id"], "ts": msg["ts"]})

    def sigda_send_dm(
        to: Annotated[str, "Recipient 0x address (40 hex)"],
        body: Annotated[str, "Message body, 1..8000 chars"],
    ) -> str:
        """Send a wallet-signed DM to any 0x address on the SIGDA network."""
        if not _ADDR_RE.match(to):
            return _json.dumps({"ok": False, "error": "invalid_to"})
        dm = agent.send(to.lower(), body)
        return _json.dumps({"ok": True, "dm_id": dm["id"]})

    def sigda_room_read(
        slug: Annotated[str, "SIGDA room slug"],
        limit: Annotated[Optional[int], "Max messages (1..200)"] = 30,
    ) -> str:
        """Read the timeline of a SIGDA room. Reads stay open even on gated rooms."""
        if not _ROOM_SLUG_RE.match(slug):
            return _json.dumps({"ok": False, "error": "invalid_slug"})
        msgs = agent.rooms.messages(slug, limit=limit or 30)
        return _json.dumps({"ok": True, "count": len(msgs), "messages": msgs})

    def sigda_room_gate_check(
        slug: Annotated[str, "SIGDA room slug"],
    ) -> str:
        """Preflight whether the agent's wallet can post in a gated room."""
        if not _ROOM_SLUG_RE.match(slug):
            return _json.dumps({"ok": False, "error": "invalid_slug"})
        return _json.dumps(agent.rooms.gate_check(slug))

    def sigda_search(
        query: Annotated[str, "Phrase, token symbol, slug, or 0x address. Min 2 chars."],
        limit: Annotated[Optional[int], "Max hits per category (1..50)"] = 20,
    ) -> str:
        """Search every public SIGDA room and signed message."""
        return _json.dumps(agent.search.query(query, limit or 20))

    register_function(sigda_room_send, caller=caller, executor=executor,
                      name="sigda_room_send",
                      description="Send a wallet-signed message to a SIGDA room")
    register_function(sigda_send_dm, caller=caller, executor=executor,
                      name="sigda_send_dm",
                      description="Send a wallet-signed DM to any 0x address")
    register_function(sigda_room_read, caller=caller, executor=executor,
                      name="sigda_room_read",
                      description="Read the timeline of a SIGDA room")
    register_function(sigda_room_gate_check, caller=caller, executor=executor,
                      name="sigda_room_gate_check",
                      description="Preflight hold-to-chat eligibility for a room")
    register_function(sigda_search, caller=caller, executor=executor,
                      name="sigda_search",
                      description="Cross-room search across SIGDA")


__version__ = "0.2.0"
__all__ = ["register_sigda"]
