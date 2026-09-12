import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 108,
            height: 108,
            background: "linear-gradient(135deg, #22c55e 0%, #0ea34f 100%)",
            borderRadius: "4px 60% 4px 60%",
            transform: "rotate(-45deg)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "18%",
              width: 4,
              height: "64%",
              background: "rgba(10,10,15,0.35)",
              borderRadius: 4,
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
