import { realpath } from "node:fs/promises";
import path from "node:path";

/** Thrown when a requested path would leave the folder the user picked. */
export class PathEscapeError extends Error {
  constructor(requested: string) {
    super(`Path is outside the game folder: ${JSON.stringify(requested)}`);
    this.name = "PathEscapeError";
  }
}

function isWithin(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  if (rel === "") return true;
  if (path.isAbsolute(rel)) return false;
  return rel !== ".." && !rel.startsWith(`..${path.sep}`);
}

/**
 * Maps a GameSource path (relative to the install root, `/`-separated, `""` for the root) to a
 * real path on disk that is guaranteed to lie inside `root`.
 *
 * The check runs twice: once on the lexical path, so `../` never reaches the filesystem, and once
 * on the fully resolved path, so a symlink inside the folder cannot point outside it.
 * Absolute paths are refused: the contract only knows relative ones.
 *
 * Rejects with PathEscapeError on an escape, and with the fs error (e.g. ENOENT) when the path
 * does not exist.
 */
export async function confinePath(root: string, requested: string): Promise<string> {
  if (typeof requested !== "string" || requested.includes("\0")) {
    throw new PathEscapeError(String(requested));
  }
  if (path.isAbsolute(requested) || path.posix.isAbsolute(requested) || path.win32.isAbsolute(requested)) {
    throw new PathEscapeError(requested);
  }
  const realRoot = await realpath(root);
  const lexical = path.resolve(realRoot, requested);
  if (!isWithin(realRoot, lexical)) throw new PathEscapeError(requested);
  const real = await realpath(lexical);
  if (!isWithin(realRoot, real)) throw new PathEscapeError(requested);
  return real;
}
