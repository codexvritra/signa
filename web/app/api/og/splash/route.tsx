import { ImageResponse } from "next/og";

export const runtime = "edge";

/** Mini App splash image — spec requires 200x200. */
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
            width: 132,
            height: 132,
            borderRadius: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #5b8def 0%, #8b5cf6 100%)",
          }}
        >
          <div
            style={{
              fontSize: 86,
              fontWeight: 800,
              color: "#ffffff",
              fontFamily: "sans-serif",
              letterSpacing: -3,
            }}
          >
            S
          </div>
        </div>
      </div>
    ),
    { width: 200, height: 200 },
  );
}
