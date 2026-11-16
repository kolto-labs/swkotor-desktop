import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { confinePath, PathEscapeError } from "../src/main/confine";
import { NativeGameFolder } from "../src/main/game-source";

let base: string;
let root: string;
let outside: string;

before(async () => {
  base = await realpath(await mkdtemp(path.join(tmpdir(), "confine-test-")));
  root = path.join(base, "game");
  outside = path.join(base, "outside");
  await mkdir(path.join(root, "data"), { recursive: true });
  await mkdir(outside);
  await writeFile(path.join(root, "chitin.key"), "key");
  await writeFile(path.join(root, "data", "a.bif"), "bif");
  await writeFile(path.join(outside, "secret.txt"), "secret");
  await symlink(path.join(outside, "secret.txt"), path.join(root, "file-link"));
  await symlink(outside, path.join(root, "dir-link"));
  await symlink(path.join(root, "data", "a.bif"), path.join(root, "inner-link"));
});

after(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("confinePath", () => {
  it("accepts paths inside the folder", async () => {
    assert.equal(await confinePath(root, "chitin.key"), path.join(root, "chitin.key"));
    assert.equal(await confinePath(root, "data/a.bif"), path.join(root, "data", "a.bif"));
    assert.equal(await confinePath(root, "data/../chitin.key"), path.join(root, "chitin.key"));
    assert.equal(await confinePath(root, ""), root);
  });

  it("accepts a symlink that stays inside the folder", async () => {
    assert.equal(await confinePath(root, "inner-link"), path.join(root, "data", "a.bif"));
  });

  it("rejects ../ escapes", async () => {
    await assert.rejects(confinePath(root, "../outside/secret.txt"), PathEscapeError);
    await assert.rejects(confinePath(root, "data/../../outside/secret.txt"), PathEscapeError);
    await assert.rejects(confinePath(root, ".."), PathEscapeError);
  });

  it("rejects absolute paths outside the folder", async () => {
    await assert.rejects(confinePath(root, path.join(outside, "secret.txt")), PathEscapeError);
    await assert.rejects(confinePath(root, "/etc/hostname"), PathEscapeError);
  });

  it("rejects symlink escapes", async () => {
    await assert.rejects(confinePath(root, "file-link"), PathEscapeError);
    await assert.rejects(confinePath(root, "dir-link/secret.txt"), PathEscapeError);
  });

  it("rejects a sibling folder whose name starts with the root's name", async () => {
    await mkdir(`${root}-evil`, { recursive: true });
    await assert.rejects(confinePath(root, "../game-evil"), PathEscapeError);
  });
});

describe("NativeGameFolder", () => {
  it("lists only entries that stay inside the folder", async () => {
    const names = (await new NativeGameFolder(root).list("")).map((e) => e.name).sort();
    assert.deepEqual(names, ["chitin.key", "data", "inner-link"]);
  });

  it("returns null from stat for a missing file and rejects escapes", async () => {
    const folder = new NativeGameFolder(root);
    assert.equal(await folder.stat("missing.bif"), null);
    assert.deepEqual(await folder.stat("data/a.bif"), { name: "a.bif", kind: "file", size: 3 });
    await assert.rejects(folder.stat("file-link"), PathEscapeError);
    await assert.rejects(folder.open("../outside/secret.txt"), PathEscapeError);
  });

  it("opens a file inside the folder", async () => {
    const bytes = await new NativeGameFolder(root).open("chitin.key");
    assert.equal(Buffer.from(bytes).toString("utf8"), "key");
  });
});
