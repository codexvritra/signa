import type { Conversation, Dm, Group } from "@xmtp/browser-sdk";

/**
 * XMTP V3 has two conversation classes: Dm (1:1) and Group (multi-party).
 * These helpers narrow the union safely without relying on imports
 * the SDK may not export as runtime values.
 */

export function isDm(conv: Conversation): conv is Dm {
  // Dm has no .name getter on the Group class side; check shape
  // (Group has updateName, members > 2 is *possible* for groups).
  // The reliable way is via the metadata.conversationType, but for sync UI
  // we use the absence of group-specific methods.
  return typeof (conv as unknown as { updateName?: unknown }).updateName !== "function";
}

export function isGroup(conv: Conversation): conv is Group {
  return typeof (conv as unknown as { updateName?: unknown }).updateName === "function";
}

export function getGroupName(conv: Conversation): string | undefined {
  try {
    const name = (conv as unknown as { name?: string }).name;
    return name && name.trim() ? name : undefined;
  } catch {
    return undefined;
  }
}

export function getGroupImageUrl(conv: Conversation): string | undefined {
  try {
    const url = (conv as unknown as { imageUrl?: string }).imageUrl;
    return url && url.trim() ? url : undefined;
  } catch {
    return undefined;
  }
}
