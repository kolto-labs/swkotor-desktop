/** True when `target` is on the launcher's own origin (scheme, host and port all equal). */
export function isLauncherUrl(target: string, launcherOrigin: string): boolean {
  try {
    return new URL(target).origin === launcherOrigin;
  } catch {
    return false;
  }
}

/** Only https links leave the app, and only to the system browser. */
export function isSafeExternalUrl(target: string): boolean {
  try {
    return new URL(target).protocol === "https:";
  } catch {
    return false;
  }
}
