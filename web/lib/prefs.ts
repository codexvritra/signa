const KEY_DISPLAY_NAME = "agent-messenger:display-name";

export function getDisplayName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(KEY_DISPLAY_NAME) ?? "";
  } catch {
    return "";
  }
}

export function setDisplayName(name: string) {
  if (typeof window === "undefined") return;
  try {
    if (name.trim()) {
      localStorage.setItem(KEY_DISPLAY_NAME, name.trim());
    } else {
      localStorage.removeItem(KEY_DISPLAY_NAME);
    }
  } catch {
    // ignore
  }
}

const DISPLAY_NAME_CHANGED = "agent-messenger:display-name-changed";

export function emitDisplayNameChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DISPLAY_NAME_CHANGED));
}

export function onDisplayNameChange(handler: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(DISPLAY_NAME_CHANGED, handler);
  return () => window.removeEventListener(DISPLAY_NAME_CHANGED, handler);
}
