import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLauncherUrl } from "../src/main/launcher-url";
import { isLauncherUrl, isSafeExternalUrl } from "../src/main/navigation";

const CLI = "https://cli.example/";
const ENV = "https://env.example/";
const CFG = "https://config.example/";

function resolve(argv: string[], env: Record<string, string>, appConfig?: unknown) {
  return resolveLauncherUrl({ argv: ["electron", ".", ...argv], env, appConfig });
}

describe("resolveLauncherUrl", () => {
  it("prefers the CLI flag over env and app-config", () => {
    const r = resolve([`--launcher-url=${CLI}`], { KOLTO_LAUNCHER_URL: ENV }, { launcherUrl: CFG });
    assert.ok(r.ok);
    assert.equal(r.url.href, CLI);
    assert.equal(r.source, "cli");
  });

  it("uses env when there is no CLI flag", () => {
    const r = resolve([], { KOLTO_LAUNCHER_URL: ENV }, { launcherUrl: CFG });
    assert.ok(r.ok);
    assert.equal(r.url.href, ENV);
    assert.equal(r.source, "env");
  });

  it("uses app-config when neither flag nor env is set", () => {
    const r = resolve([], { KOLTO_LAUNCHER_URL: "  " }, { launcherUrl: CFG });
    assert.ok(r.ok);
    assert.equal(r.url.href, CFG);
    assert.equal(r.source, "app-config");
  });

  it("reports not configured when nothing is set", () => {
    const r = resolve([], {}, undefined);
    assert.equal(r.ok, false);
  });

  it("rejects non-https URLs instead of falling through", () => {
    assert.equal(resolve(["--launcher-url=http://remote.example/"], { KOLTO_LAUNCHER_URL: ENV }).ok, false);
    assert.equal(resolve([], { KOLTO_LAUNCHER_URL: "file:///tmp/x.html" }).ok, false);
    assert.equal(resolve([], {}, { launcherUrl: "not a url" }).ok, false);
  });

  it("allows plain http on loopback for development", () => {
    const r = resolve(["--launcher-url=http://localhost:5173/"], {});
    assert.ok(r.ok);
    assert.equal(r.url.origin, "http://localhost:5173");
  });
});

describe("navigation rules", () => {
  it("allows only the launcher origin", () => {
    assert.ok(isLauncherUrl("https://cli.example/play?x=1", "https://cli.example"));
    assert.ok(!isLauncherUrl("https://cli.example.evil/", "https://cli.example"));
    assert.ok(!isLauncherUrl("http://cli.example/", "https://cli.example"));
    assert.ok(!isLauncherUrl("not a url", "https://cli.example"));
  });

  it("opens only https links externally", () => {
    assert.ok(isSafeExternalUrl("https://example.org/"));
    assert.ok(!isSafeExternalUrl("http://example.org/"));
    assert.ok(!isSafeExternalUrl("file:///etc/passwd"));
    assert.ok(!isSafeExternalUrl("javascript:alert(1)"));
  });
});
