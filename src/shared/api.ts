import type { Entry, GameSource } from "@kolto-labs/kotor-runtime-api";

/** IPC channel names shared by the main process and the preload. */
export type Channel =
  | "kolto:pick-game-folder"
  | "kolto:fs:list"
  | "kolto:fs:stat"
  | "kolto:fs:open";

/** What a picked folder reveals to the page: its name only, never the full path on disk. */
export interface PickedFolder {
  name: string;
}

/**
 * The native-fs GameSource as the page sees it. `open` returns the whole file as an ArrayBuffer
 * (v0); the page wraps it in a Blob to satisfy GameSource.open.
 */
export interface NativeFsBridge extends Pick<GameSource, "list" | "stat"> {
  readonly kind: Extract<GameSource["kind"], "native-fs">;
  open(path: string): Promise<ArrayBuffer>;
}

export interface KoltoDesktopApi {
  /** Shows the native folder dialog. Resolves to null when the user cancels. */
  pickGameFolder(): Promise<PickedFolder | null>;
  readonly gameSource: NativeFsBridge;
}

export type { Entry };

declare global {
  interface Window {
    koltoDesktop?: KoltoDesktopApi;
  }
}
