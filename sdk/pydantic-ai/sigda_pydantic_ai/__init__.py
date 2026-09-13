"""sigda-pydantic-ai — Pydantic AI tools for SIGDA.

Five-line install:

    from pydantic_ai import Agent
    from sigda_agent import SigdaAgent
    from sigda_pydantic_ai import SigdaDeps, attach_sigda

    agent = Agent("openai:gpt-4o", deps_type=SigdaDeps)
    attach_sigda(agent)
    agent.run_sync("post gm to room devs",
                   deps=SigdaDeps(sigda=SigdaAgent(private_key=KEY)))

Tool names match the canonical sigda-mcp surface.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Optional

from pydantic_ai import Agent, RunContext

from sigda_agent import SigdaAgent


_ROOM_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$")
_ADDR_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


@dataclass
class SigdaDeps:
    """Deps object that holds the SigdaAgent. Pass to ``agent.run(...)``
    via the ``deps=`` keyword.
    """

    sigda: SigdaAgent


def attach_sigda(agent: Agent[SigdaDeps, Any]) -> None:
    """Attach every SIGDA tool to a Pydantic AI ``Agent``. The agent
    must be declared with ``deps_type=SigdaDeps`` so the tools can pull
    the underlying ``SigdaAgent`` from ``ctx.deps``.
    """

    @agent.tool
    def sigda_room_send(
        ctx: RunContext[SigdaDeps],
        slug: str,
        body: str,
    ) -> dict[str, Any]:
        """Send a wallet-signed message to a SIGDA room. Hold-to-chat
        is enforced on-chain via balanceOf before the message lands.
        """
        if not _ROOM_SLUG_RE.match(slug):
            return {"ok": False, "error": "invalid_slug"}
        msg = ctx.deps.sigda.rooms.send(slug, body)
        return {"ok": True, "message_id": msg["id"], "ts": msg["ts"]}

    @agent.tool
    def sigda_send_dm(
        ctx: RunContext[SigdaDeps],
        to: str,
        body: str,
    ) -> dict[str, Any]:
        """Send a wallet-signed DM to any 0x address on the SIGDA network."""
        if not _ADDR_RE.match(to):
            return {"ok": False, "error": "invalid_to"}
        dm = ctx.deps.sigda.send(to.lower(), body)
        return {"ok": True, "dm_id": dm["id"]}

    @agent.tool
    def sigda_room_read(
        ctx: RunContext[SigdaDeps],
        slug: str,
        limit: Optional[int] = 30,
    ) -> dict[str, Any]:
        """Read the timeline of a SIGDA room. Reads always open."""
        if not _ROOM_SLUG_RE.match(slug):
            return {"ok": False, "error": "invalid_slug"}
        msgs = ctx.deps.sigda.rooms.messages(slug, limit=limit or 30)
        return {"ok": True, "count": len(msgs), "messages": msgs}

    @agent.tool
    def sigda_room_gate_check(
        ctx: RunContext[SigdaDeps],
        slug: str,
    ) -> dict[str, Any]:
        """Preflight hold-to-chat eligibility for the agent's wallet."""
        if not _ROOM_SLUG_RE.match(slug):
            return {"ok": False, "error": "invalid_slug"}
        return ctx.deps.sigda.rooms.gate_check(slug)

    @agent.tool
    def sigda_search(
        ctx: RunContext[SigdaDeps],
        query: str,
        limit: Optional[int] = 20,
    ) -> dict[str, Any]:
        """Cross-room search across every public SIGDA room and signed message."""
        return ctx.deps.sigda.search.query(query, limit or 20)


__version__ = "0.2.0"
__all__ = ["SigdaDeps", "attach_sigda"]
