import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Entry } from "@kolto-labs/kotor-runtime-api";
import { confinePath } from "./confine";

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === "ENOENT";
}

async function entryFor(realPath: string, name: string): Promise<Entry | null> {
  const info = await stat(realPath);
  if (info.isDirectory()) return { name, kind: "directory" };
  if (info.isFile()) return { name, kind: "file", size: info.size };
  return null;
}

/** Read-only native-fs operations confined to one folder. Every path goes through confinePath. */
export class NativeGameFolder {
  constructor(readonly root: string) {}

  async list(dir: string): Promise<Entry[]> {
    const real = await confinePath(this.root, dir);
    const names = await readdir(real);
    const entries: Entry[] = [];
    for (const name of names) {
      const child = dir === "" ? name : `${dir}/${name}`;
      try {
        // Re-confine each child so a symlink inside the folder cannot expose what it points to.
        const entry = await entryFor(await confinePath(this.root, child), name);
        if (entry) entries.push(entry);
      } catch {
        // Escaping links, broken links and unreadable entries are left out of the listing.
      }
    }
    return entries;
  }

  async stat(requested: string): Promise<Entry | null> {
    let real: string;
    try {
      real = await confinePath(this.root, requested);
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
    const name = requested === "" ? path.basename(this.root) : path.posix.basename(requested);
    return entryFor(real, name);
  }

  async open(requested: string): Promise<Uint8Array> {
    const real = await confinePath(this.root, requested);
    return readFile(real);
  }
}
