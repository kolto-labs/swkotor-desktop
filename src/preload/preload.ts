// Runs sandboxed: only "electron" may be required here, so local modules are imported as types only.
import { contextBridge, ipcRenderer } from "electron";
import type { Channel, Entry, KoltoDesktopApi, PickedFolder } from "../shared/api";

const PICK: Channel = "kolto:pick-game-folder";
const LIST: Channel = "kolto:fs:list";
const STAT: Channel = "kolto:fs:stat";
const OPEN: Channel = "kolto:fs:open";

function asString(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("path must be a string");
  return value;
}

const api: KoltoDesktopApi = {
  pickGameFolder: () => ipcRenderer.invoke(PICK) as Promise<PickedFolder | null>,
  gameSource: {
    kind: "native-fs",
    list: (dir) => ipcRenderer.invoke(LIST, asString(dir)) as Promise<Entry[]>,
    stat: (path) => ipcRenderer.invoke(STAT, asString(path)) as Promise<Entry | null>,
    open: async (path) => {
      const bytes = (await ipcRenderer.invoke(OPEN, asString(path))) as Uint8Array;
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
  },
};

contextBridge.exposeInMainWorld("koltoDesktop", api);
