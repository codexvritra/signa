/**
 * Farcaster / Base App Mini App wiring — one source of truth for the embed
 * meta tags + manifest + image URLs, built to the current Mini App spec
 * (https://miniapps.farcaster.xyz/docs/specification).
 *
 * The embed is what makes a SIGNA URL render as an interactive card *inside*
 * the feed instead of a plain link: a 3:2 image + a launch button. Tapping it
 * opens the Mini App. That in-feed surface is the whole point — SIGNA stops
 * being an island and lives where the Base crowd already is.
 */

export const SITE = "https://www.signaagent.xyz";

export const MINIAPP = {
  name: "SIGNA",
  // image dimensions are spec-mandated: icon 1024x1024 (no alpha),
  // splash 200x200, embed image 3:2.
  iconUrl: `${SITE}/api/og/icon`,
  splashImageUrl: `${SITE}/api/og/splash`,
  splashBackgroundColor: "#0a0a0f",
  homeUrl: `${SITE}/mini`,
} as const;

/** The 3:2 embed image for the Mini App home card. */
export const HOME_EMBED_IMAGE = `${SITE}/api/og/mini-embed`;

/** The 3:2 embed image for a specific signed note. */
export function noteEmbedImage(id: string): string {
  return `${SITE}/api/og/note/${id}`;
}

type Embed = {
  version: "1";
  imageUrl: string;
  button: {
    title: string;
    action: {
      type: string;
      name: string;
      url: string;
      splashImageUrl: string;
      splashBackgroundColor: string;
    };
  };
};

function embed(imageUrl: string, launchUrl: string, title: string, actionType: string): Embed {
  return {
    version: "1",
    imageUrl,
    button: {
      title,
      action: {
        type: actionType,
        name: MINIAPP.name,
        url: launchUrl,
        splashImageUrl: MINIAPP.splashImageUrl,
        splashBackgroundColor: MINIAPP.splashBackgroundColor,
      },
    },
  };
}

/**
 * Returns the `other` metadata map for a Next.js route: emits BOTH the current
 * `fc:miniapp` tag (action type `launch_miniapp`) and the legacy `fc:frame`
 * tag (action type `launch_frame`) so new and old clients both render the card.
 *
 * @param imageUrl  3:2 embed image
 * @param launchUrl URL the Mini App opens to when the button is tapped
 * @param title     button label (≤32 chars)
 */
export function miniAppEmbedMeta(
  imageUrl: string,
  launchUrl: string = MINIAPP.homeUrl,
  title: string = "Sign on Base",
): Record<string, string> {
  return {
    "fc:miniapp": JSON.stringify(embed(imageUrl, launchUrl, title, "launch_miniapp")),
    "fc:frame": JSON.stringify(embed(imageUrl, launchUrl, title, "launch_frame")),
  };
}
