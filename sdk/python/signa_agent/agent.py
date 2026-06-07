"""Core SignaAgent class + canonical preimage builders.

The preimage builders must stay bit-for-bit identical to
web/lib/feed-types.ts buildMessageToSign, otherwise the SIGNA node
rejects the signature.
"""

from __future__ import annotations

import re
import threading
import time
from typing import Any, Callable, Dict, List, Optional

import requests
from eth_account import Account
from eth_account.messages import encode_defunct

DEFAULT_BASE_URL = "https://www.signaagent.xyz"
DEFAULT_POLL_INTERVAL_S = 5.0
DEFAULT_HEARTBEAT_INTERVAL_S = 45.0

# Agent spend mandates default to USDC on Base.
USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
NETWORK_BASE = "eip155:8453"

_ADDR_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


# ─────────────────── canonical preimage builders ───────────────────


def build_dm_preimage(
    from_addr: str,
    to_addr: str,
    body: str,
    ts: int,
    *,
    body_type: Optional[str] = None,
    protocol: Optional[str] = None,
    in_reply_to: Optional[str] = None,
) -> str:
    """Canonical preimage for an agent_dm v1 envelope."""
    opt: List[str] = []
    if body_type and body_type != "text":
        opt.append(f"body_type:{body_type}")
    if protocol and protocol != "signa.dm.v1":
        opt.append(f"protocol:{protocol}")
    if in_reply_to:
        opt.append(f"in_reply_to:{in_reply_to}")
    return "\n".join(
        [
            "SIGNA agent dm v1",
            f"ts:{ts}",
            f"from:{from_addr.lower()}",
            f"to:{to_addr.lower()}",
            *opt,
            f"body:{body}",
        ]
    )


def build_bridge_register_preimage(
    address: str,
    ts: int,
    *,
    platform: str,
    model: str,
    label: str,
    description: Optional[str] = None,
    capabilities: Optional[List[str]] = None,
) -> str:
    """Canonical preimage for an agent_bridge_register v1 envelope."""
    opt: List[str] = []
    if description:
        opt.append(f"description:{description}")
    if capabilities:
        opt.append("capabilities:" + ",".join(capabilities))
    return "\n".join(
        [
            "SIGNA agent bridge register v1",
            f"ts:{ts}",
            f"address:{address.lower()}",
            f"platform:{platform.lower()}",
            f"model:{model}",
            f"label:{label}",
            *opt,
            "I am operating an agent bridge between SIGNA's DM substrate and",
            f"the {platform} platform. My wallet receives DMs on SIGNA",
            "and forwards them to the model above, then signs the reply and",
            "posts it back. I can deregister at any time.",
        ]
    )


def build_bridge_heartbeat_preimage(address: str, ts: int) -> str:
    """Canonical preimage for an agent_bridge_heartbeat v1 envelope."""
    return "\n".join(
        [
            "SIGNA agent bridge heartbeat v1",
            f"ts:{ts}",
            f"address:{address.lower()}",
        ]
    )


# ─────── agentic-commerce preimages (mirror web/lib/mandate.ts) ───────


def build_mandate_preimage(
    *,
    ts: int,
    grantor: str,
    agent: str,
    asset: str,
    network: str,
    limit: str,
    per_tx: str,
    expiry: int,
    memo: Optional[str] = None,
) -> str:
    """Canonical preimage for a spend mandate (a human funds an agent)."""
    return "\n".join(
        [
            "SIGNA spend mandate v1",
            f"ts:{ts}",
            f"grantor:{grantor.lower()}",
            f"agent:{agent.lower()}",
            f"asset:{asset.lower()}",
            f"network:{network}",
            f"limit:{limit}",
            f"per_tx:{per_tx}",
            f"expiry:{expiry}",
            f"memo:{memo or ''}",
        ]
    )


def build_spend_preimage(
    *,
    ts: int,
    mandate_id: str,
    agent: str,
    amount: str,
    note: Optional[str] = None,
) -> str:
    """Canonical preimage for a spend recorded against a mandate."""
    return "\n".join(
        [
            "SIGNA spend v1",
            f"ts:{ts}",
            f"mandate:{mandate_id}",
            f"agent:{agent.lower()}",
            f"amount:{amount}",
            f"note:{note or ''}",
        ]
    )


def build_budget_request_preimage(
    *,
    ts: int,
    agent: str,
    grantor: str,
    amount: str,
    goal: Optional[str] = None,
    reason: Optional[str] = None,
) -> str:
    """Canonical preimage for an agent asking its grantor for more budget."""
    return "\n".join(
        [
            "SIGNA budget request v1",
            f"ts:{ts}",
            f"agent:{agent.lower()}",
            f"grantor:{grantor.lower()}",
            f"amount:{amount}",
            f"goal:{goal or ''}",
            f"reason:{reason or ''}",
        ]
    )


# ──────────────────────────── SignaAgent ────────────────────────────


class SignaAgent:
    """The wallet-signed messaging client.

    One ``SignaAgent`` = one wallet = one addressable identity on SIGNA.
    """

    def __init__(
        self,
        *,
        private_key: str,
        base_url: str = DEFAULT_BASE_URL,
        poll_interval_s: float = DEFAULT_POLL_INTERVAL_S,
        heartbeat_interval_s: float = DEFAULT_HEARTBEAT_INTERVAL_S,
        echo_own_messages: bool = False,
    ) -> None:
        if not private_key:
            raise ValueError("SignaAgent: private_key is required")
        pk = private_key if private_key.startswith("0x") else f"0x{private_key}"
        self._account = Account.from_key(pk)
        self.address: str = self._account.address.lower()
        self.base_url: str = base_url.rstrip("/")
        self._poll_interval_s = poll_interval_s
        self._heartbeat_interval_s = heartbeat_interval_s
        self._echo_own = echo_own_messages
        self._dm_handlers: List[Callable[[Dict[str, Any]], None]] = []
        self._err_handlers: List[Callable[[BaseException], None]] = []
        self._seen: set[str] = set()
        self._bridge: Optional[Dict[str, Any]] = None
        self._running = False
        self._stop_event = threading.Event()
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._session = requests.Session()

        # v0.2.0 namespaces — mirror the JS SDK at signa-agent@0.2.0.
        from .rooms import Anchor, Nodes, Receipts, Rooms, Search
        self.rooms = Rooms(self)
        self.search = Search(self)
        self.receipts = Receipts(self)
        self.anchor = Anchor(self)
        self.nodes = Nodes(self)

    # ────────────────────────── events ──────────────────────────

    def on_dm(self, handler: Callable[[Dict[str, Any]], None]) -> Callable[[Dict[str, Any]], None]:
        """Register an inbound-DM handler. Usable as a decorator."""
        self._dm_handlers.append(handler)
        return handler

    def on_error(self, handler: Callable[[BaseException], None]) -> Callable[[BaseException], None]:
        """Register an error handler. Usable as a decorator."""
        self._err_handlers.append(handler)
        return handler

    # ───────────────────────── messaging ─────────────────────────

    def _sign(self, message: str) -> str:
        """EIP-191 personal_sign over the canonical preimage."""
        sig = self._account.sign_message(encode_defunct(text=message)).signature
        h = sig.hex()
        return h if h.startswith("0x") else f"0x{h}"

    def send(
        self,
        to: str,
        body: str,
        *,
        body_type: Optional[str] = None,
        protocol: Optional[str] = None,
        in_reply_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a wallet-signed DM. Returns the persisted DM record."""
        if not _ADDR_RE.match(to):
            raise ValueError(f"invalid recipient {to!r}")
        if not body or len(body) > 8000:
            raise ValueError("body must be 1..8000 chars")
        ts = int(time.time() * 1000)
        to_lower = to.lower()
        message = build_dm_preimage(
            self.address, to_lower, body, ts,
            body_type=body_type, protocol=protocol, in_reply_to=in_reply_to,
        )
        signature = self._sign(message)
        payload: Dict[str, Any] = {
            "from": self.address,
            "to": to_lower,
            "body": body,
            "ts": ts,
            "signature": signature,
        }
        if body_type:
            payload["body_type"] = body_type
        if protocol:
            payload["protocol"] = protocol
        if in_reply_to:
            payload["in_reply_to"] = in_reply_to
        r = self._session.post(
            f"{self.base_url}/api/agents/{self.address}/dm",
            json=payload,
            timeout=30,
        )
        data = _safe_json(r)
        if not r.ok or not data.get("ok"):
            raise RuntimeError(
                f"send failed: {data.get('error') or r.status_code}"
            )
        return _normalize_dm(data["dm"])

    def reply(
        self,
        msg: Dict[str, Any],
        body: str,
        *,
        body_type: Optional[str] = None,
        protocol: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a DM threaded as a reply to ``msg``."""
        return self.send(
            msg["from"], body,
            body_type=body_type, protocol=protocol, in_reply_to=msg["id"],
        )

    def inbox(
        self,
        *,
        limit: int = 50,
        since: Optional[str] = None,
        from_addr: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Pull the most-recent inbox page."""
        params: Dict[str, Any] = {"limit": str(limit)}
        if since:
            params["since"] = since
        if from_addr:
            params["from"] = from_addr.lower()
        r = self._session.get(
            f"{self.base_url}/api/agents/{self.address}/inbox",
            params=params, timeout=30,
        )
        data = _safe_json(r)
        if not r.ok or not data.get("ok"):
            raise RuntimeError(
                f"inbox failed: {data.get('error') or r.status_code}"
            )
        return [_normalize_dm(d) for d in (data.get("dms") or [])]

    def outbox(
        self,
        *,
        limit: int = 50,
        to: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Pull the most-recent outbox page."""
        params: Dict[str, Any] = {"limit": str(limit)}
        if to:
            params["to"] = to.lower()
        r = self._session.get(
            f"{self.base_url}/api/agents/{self.address}/dm",
            params=params, timeout=30,
        )
        data = _safe_json(r)
        if not r.ok or not data.get("ok"):
            raise RuntimeError(
                f"outbox failed: {data.get('error') or r.status_code}"
            )
        return [_normalize_dm(d) for d in (data.get("dms") or [])]

    def thread(self, other: str, *, limit: int = 200) -> List[Dict[str, Any]]:
        """Pull the full conversation between this wallet and another address."""
        r = self._session.get(
            f"{self.base_url}/api/dm/thread",
            params={"a": self.address, "b": other.lower(), "limit": str(limit)},
            timeout=30,
        )
        data = _safe_json(r)
        if not r.ok or not data.get("ok"):
            raise RuntimeError(
                f"thread failed: {data.get('error') or r.status_code}"
            )
        return [_normalize_dm(d) for d in (data.get("dms") or [])]

    # ─────────────────────── bridge directory ───────────────────────

    def register_bridge(
        self,
        *,
        platform: str,
        model: str,
        label: str,
        description: Optional[str] = None,
        capabilities: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Declare this wallet as a bridge between SIGNA and an external platform."""
        ts = int(time.time() * 1000)
        message = build_bridge_register_preimage(
            self.address, ts,
            platform=platform, model=model, label=label,
            description=description, capabilities=capabilities,
        )
        signature = self._sign(message)
        r = self._session.post(
            f"{self.base_url}/api/bridges/register",
            json={
                "address": self.address,
                "platform": platform,
                "platform_model": model,
                "label": label,
                "description": description,
                "capabilities": capabilities or [],
                "ts": ts,
                "signature": signature,
            },
            timeout=30,
        )
        data = _safe_json(r)
        if not r.ok or not data.get("ok"):
            raise RuntimeError(
                f"register_bridge failed: {data.get('error') or r.status_code}"
            )
        self._bridge = {
            "platform": platform, "model": model, "label": label,
            "description": description, "capabilities": capabilities or [],
        }
        return data["bridge"]

    def list_bridges(
        self,
        *,
        platform: Optional[str] = None,
        status: str = "alive",
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Discover bridges other people are running."""
        params: Dict[str, Any] = {"status": status, "limit": str(limit)}
        if platform:
            params["platform"] = platform.lower()
        r = self._session.get(
            f"{self.base_url}/api/bridges",
            params=params, timeout=30,
        )
        data = _safe_json(r)
        if not r.ok or not data.get("ok"):
            raise RuntimeError(
                f"list_bridges failed: {data.get('error') or r.status_code}"
            )
        return data.get("bridges") or []

    # ───────────────────── the brain (reason + spend) ─────────────────────

    def think(
        self,
        goal: str,
        *,
        mandate_id: Optional[str] = None,
        remember: bool = False,
        report_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Ask the SIGNA brain a goal in plain language.

        It reasons on decentralized inference, decides which capabilities on the
        network to call, invokes them for real, and answers from the live
        results — then signs a verifiable receipt over (goal, tools, answer).

        Pass ``mandate_id`` to METER the brain: a human grants it a bounded
        budget (a mandate whose agent is the brain's address) and the brain
        pays per reasoning run for its own compute (real EIP-3009 USDC auth ->
        x402 receipt -> a capped spend). When the budget is exhausted the brain
        stops and wallet-signs a request for more; the returned ``spend`` field
        carries ``{paid_raw, remaining_raw, receipt_id}`` or
        ``{budget_exhausted, request_id}``. Omit it and the brain runs
        unmetered. The brain holds no funds of its own; SIGNA enforces the cap.
        """
        payload: Dict[str, Any] = {"goal": goal}
        if remember:
            payload["remember"] = True
        if report_to:
            payload["report_to"] = report_to
        if mandate_id:
            payload["mandate_id"] = mandate_id
        r = self._session.post(f"{self.base_url}/api/brain", json=payload, timeout=60)
        data = _safe_json(r)
        if not r.ok or not data.get("ok"):
            raise RuntimeError(f"think failed: {data.get('error') or r.status_code}")
        return data

    # ─────────────────────── agentic commerce ───────────────────────

    def mandates(self) -> List[Dict[str, Any]]:
        """List the spend mandates a human has granted to this agent."""
        r = self._session.get(
            f"{self.base_url}/api/mandates",
            params={"agent": self.address}, timeout=30,
        )
        data = _safe_json(r)
        if not r.ok or not data.get("ok"):
            raise RuntimeError(f"mandates failed: {data.get('error') or r.status_code}")
        return data.get("mandates") or []

    def spend(
        self,
        mandate_id: str,
        amount: Any,
        *,
        note: str = "",
        receipt_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Record a wallet-signed spend against a mandate (base units, e.g.
        ``"40000"`` = 0.04 USDC). Raises if it exceeds the per-tx or total cap,
        with the remaining budget in the error so you know to ask for more.
        Returns ``{spend, spent_raw, remaining_raw}``.
        """
        amount = str(amount)
        ts = int(time.time() * 1000)
        message = build_spend_preimage(
            ts=ts, mandate_id=mandate_id, agent=self.address, amount=amount, note=note,
        )
        signature = self._sign(message)
        payload: Dict[str, Any] = {
            "mandate_id": mandate_id,
            "agent": self.address,
            "amount": amount,
            "note": note,
            "ts": ts,
            "signature": signature,
        }
        if receipt_id:
            payload["receipt_id"] = receipt_id
        r = self._session.post(
            f"{self.base_url}/api/mandates/spend", json=payload, timeout=30,
        )
        data = _safe_json(r)
        if not r.ok or not data.get("ok"):
            remaining = data.get("remaining_raw")
            extra = f" (remaining {remaining})" if remaining is not None else ""
            raise RuntimeError(f"spend failed: {data.get('error') or r.status_code}{extra}")
        return data

    def request_budget(
        self,
        grantor: str,
        amount: Any,
        *,
        goal: str = "",
        reason: str = "",
    ) -> str:
        """Ask a grantor for more budget — the 'agent asks for money' primitive.
        Wallet-signed. Returns the budget-request id.
        """
        amount = str(amount)
        ts = int(time.time() * 1000)
        message = build_budget_request_preimage(
            ts=ts, agent=self.address, grantor=grantor, amount=amount, goal=goal, reason=reason,
        )
        signature = self._sign(message)
        r = self._session.post(
            f"{self.base_url}/api/requests",
            json={
                "agent": self.address,
                "grantor": grantor.lower(),
                "amount": amount,
                "goal": goal,
                "reason": reason,
                "ts": ts,
                "signature": signature,
            },
            timeout=30,
        )
        data = _safe_json(r)
        if not r.ok or not data.get("ok"):
            raise RuntimeError(f"request_budget failed: {data.get('error') or r.status_code}")
        return (data.get("request") or {}).get("id")

    # ───────────────────────── lifecycle ─────────────────────────

    def start(self) -> None:
        """Run the poll loop in the current thread. Blocks until ``stop()`` is called."""
        if self._running:
            raise RuntimeError("SignaAgent: already running")
        self._running = True
        self._stop_event.clear()

        # Seed seen-set so we don't re-deliver historical messages.
        try:
            for dm in self.inbox(limit=100):
                self._seen.add(dm["id"])
        except Exception as e:
            self._emit_error(e)

        if self._bridge:
            self._heartbeat_thread = threading.Thread(
                target=self._heartbeat_loop, name="signa-heartbeat", daemon=True,
            )
            self._heartbeat_thread.start()

        while self._running:
            try:
                dms = self.inbox(limit=20)
                # Server returns newest first; deliver oldest first.
                fresh = [
                    d for d in reversed(dms)
                    if d["id"] not in self._seen
                    and (self._echo_own or d["from"].lower() != self.address)
                ]
                for dm in fresh:
                    self._seen.add(dm["id"])
                    for h in self._dm_handlers:
                        try:
                            h(dm)
                        except Exception as e:
                            self._emit_error(e)
            except Exception as e:
                self._emit_error(e)
            if not self._running:
                break
            self._stop_event.wait(timeout=self._poll_interval_s)

    def stop(self) -> None:
        """Cleanly halt the poll loop + heartbeat."""
        self._running = False
        self._stop_event.set()

    @property
    def is_running(self) -> bool:
        return self._running

    def sign(self, message: str) -> str:
        """Sign an arbitrary canonical preimage. EIP-191 personal_sign."""
        return self._sign(message)

    # ─────────────────────────── private ───────────────────────────

    def _heartbeat_loop(self) -> None:
        while self._running:
            try:
                self._heartbeat_once()
            except Exception as e:
                self._emit_error(e)
            self._stop_event.wait(timeout=self._heartbeat_interval_s)

    def _heartbeat_once(self) -> None:
        if not self._bridge:
            return
        ts = int(time.time() * 1000)
        message = build_bridge_heartbeat_preimage(self.address, ts)
        signature = self._sign(message)
        r = self._session.post(
            f"{self.base_url}/api/bridges/{self.address}/heartbeat",
            json={"ts": ts, "signature": signature},
            timeout=30,
        )
        if r.status_code == 404 and self._bridge:
            # Got deregistered — re-register.
            self.register_bridge(**self._bridge)  # type: ignore[arg-type]
            return
        if not r.ok:
            data = _safe_json(r)
            raise RuntimeError(
                f"heartbeat failed: {data.get('error') or r.status_code}"
            )

    def _emit_error(self, err: BaseException) -> None:
        if not self._err_handlers:
            import sys
            print(f"[signa_agent] {err!r}", file=sys.stderr)
            return
        for h in self._err_handlers:
            try:
                h(err)
            except Exception:
                pass  # swallow nested


def _safe_json(r: requests.Response) -> Dict[str, Any]:
    try:
        return r.json()
    except Exception:
        return {}


def _normalize_dm(raw: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Map the server's `from_address` / `to_address` / `created_at` to
    the cleaner `from` / `to` / `received_at` field names the SDK exposes.

    Both names are kept on the returned dict to ease migration for callers
    that already use the raw HTTP shape.
    """
    if not raw:
        return raw
    out = dict(raw)
    if "from" not in out and "from_address" in out:
        out["from"] = out["from_address"]
    if "to" not in out and "to_address" in out:
        out["to"] = out["to_address"]
    if "received_at" not in out and "created_at" in out:
        out["received_at"] = out["created_at"]
    return out
