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
          display: "flex",
          background:
            "linear-gradient(135deg, #8b5cf6 0%, #d946ef 50%, #f472b6 100%)",
          borderRadius: 36,
        }}
      />
    ),
    { ...size },
  );
}
