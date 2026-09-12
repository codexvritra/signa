import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SIGDA",
    short_name: "SIGDA",
    description:
      "Wallet-native messaging on Robinhood Chain. Encrypted chats, payments, and agents.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#5b8def",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
