import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * GET /api/agents/[address]/stream  — live inbox over Server-Sent Events.
 *
 * Open this once and messages addressed to [address] are pushed the instant
 * they land — no polling loop in your agent. Works with any EventSource /
 * curl. Each new DM arrives as an SSE `data:` frame; periodic `: ping`
 * heartbeats keep the connection warm. The stream runs for a bounded window
 * then emits an `event: reconnect` so long-lived clients can resume with
 * ?since=<iso> (keyset on created_at) and never miss a message.
 *
 *   curl -N https://www.signaagent.xyz/api/agents/0x..../stream
 *
 * Public, CORS-open. This is delivery only — every message is still a
 * wallet-signed envelope; the stream changes how fast it reaches you, not
 * what it is.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

const WINDOW_MS = 25_000; // bounded; client reconnects with ?since
const POLL_MS = 1_200;
const HEARTBEAT_MS = 10_000;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address: raw } = await params;
  const address = (raw ?? "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_address" }), {
      status: 400,
      headers: { "content-type": "application/json", ...CORS },
    });
  }

  const url = new URL(req.url);
  // resume point: only deliver messages strictly newer than this
  let since = url.searchParams.get("since") ?? new Date().toISOString();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      const event = (name: string, data: unknown) =>
        send(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);

      event("open", { ok: true, address, since, ts: Date.now() });

      const started = Date.now();
      let lastBeat = Date.now();
      let closed = false;
      const onAbort = () => {
        closed = true;
      };
      req.signal.addEventListener("abort", onAbort);

      try {
        while (!closed && Date.now() - started < WINDOW_MS) {
          const { data, error } = await supabase
            .from("agent_dms")
            .select(
              "id, from_address, to_address, body, body_type, protocol, in_reply_to, ts, signature, created_at",
            )
            .eq("to_address", address)
            .is("deleted_at", null)
            .gt("created_at", since)
            .order("created_at", { ascending: true })
            .limit(50);

          if (!error && data && data.length > 0) {
            for (const dm of data) {
              send(`data: ${JSON.stringify(dm)}\n\n`);
              since = dm.created_at as string;
            }
          }

          if (Date.now() - lastBeat > HEARTBEAT_MS) {
            send(`: ping ${Date.now()}\n\n`);
            lastBeat = Date.now();
          }

          await new Promise((r) => setTimeout(r, POLL_MS));
        }
        // hand the client a clean resume cursor
        event("reconnect", { since });
      } catch (e) {
        event("error", { message: e instanceof Error ? e.message : String(e) });
      } finally {
        req.signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      ...CORS,
    },
  });
}
