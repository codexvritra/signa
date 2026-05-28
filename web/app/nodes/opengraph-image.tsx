import { ImageResponse } from "next/og";
import { listFederatedNodes, SIGNA_NODE_REGISTRY } from "@/lib/onchain-nodes";

// Edge runtime: opts out of static prerendering at build time so satori
// doesn't trip on the multi-child container during `next build`. The
// receipts OG card uses the same pattern and ships fine.
export const runtime = "edge";
export const alt = "signa · federated nodes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * /nodes/opengraph-image
 *
 * Static OG card for /nodes. Built defensively for satori — every
 * parent div has explicit display set, every text node is a single
 * inline string (no JSX line breaks → multi-text-node hazard), and
 * all data is pre-formatted into local consts before the JSX tree.
 */
export default async function Image() {
  let total = 0;
  let active = 0;
  try {
    const data = await listFederatedNodes(true, 50);
    total = data.total;
    active = data.active;
  } catch {
    // ignore — fall through to zeroed display
  }

  const registryShort = `${SIGNA_NODE_REGISTRY.slice(0, 10)}…${SIGNA_NODE_REGISTRY.slice(-8)}`;
  const headline = "SIGNA federates over an on-chain registry.";
  const subhead = "Permissionless. Self-hostable. Every node is an on-chain record on Base. No central directory we control.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          color: "#e5e5e5",
          fontFamily: "monospace",
          padding: 56,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#666",
            fontSize: 20,
            letterSpacing: 4,
          }}
        >
          <div style={{ display: "flex" }}>SIGNA · FEDERATED NODES</div>
          <div style={{ display: "flex" }}>signaagent.xyz/nodes</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              color: "#fff",
              fontSize: 60,
              lineHeight: 1.05,
            }}
          >
            {headline}
          </div>
          <div
            style={{
              display: "flex",
              color: "#aaa",
              fontSize: 22,
              lineHeight: 1.4,
              maxWidth: 1000,
            }}
          >
            {subhead}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 32,
            fontSize: 22,
            borderTop: "1px solid #222",
            paddingTop: 24,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: "#86efac", fontSize: 56 }}>
              {String(active)}
            </div>
            <div
              style={{
                display: "flex",
                color: "#5dd0c6",
                fontSize: 16,
                letterSpacing: 3,
              }}
            >
              ACTIVE
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: "#86efac", fontSize: 56 }}>
              {String(total)}
            </div>
            <div
              style={{
                display: "flex",
                color: "#5dd0c6",
                fontSize: 16,
                letterSpacing: 3,
              }}
            >
              TOTAL ON CHAIN
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                color: "#888",
                fontSize: 14,
                letterSpacing: 1,
              }}
            >
              registry
            </div>
            <div
              style={{
                display: "flex",
                color: "#ddd",
                fontSize: 14,
                fontFamily: "monospace",
              }}
            >
              {registryShort}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
