import { ImageResponse } from "next/og";

export const runtime = "edge";

/** Mini App icon — spec requires 1024x1024 PNG, no alpha (fully opaque bg). */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0f",
        }}
      >
        <div
          style={{
            width: 620,
            height: 620,
            borderRadius: 140,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #5b8def 0%, #8b5cf6 100%)",
            boxShadow: "0 0 120px 0 rgba(124,156,255,0.45)",
          }}
        >
          <div
            style={{
              fontSize: 400,
              fontWeight: 800,
              color: "#ffffff",
              fontFamily: "sans-serif",
              letterSpacing: -12,
            }}
          >
            S
          </div>
        </div>
      </div>
    ),
    { width: 1024, height: 1024 },
  );
}
