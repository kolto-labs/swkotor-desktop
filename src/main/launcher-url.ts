export const CLI_FLAG = "--launcher-url=";
export const ENV_VAR = "KOLTO_LAUNCHER_URL";

export type LauncherUrlSource = "cli" | "env" | "app-config";

export type LauncherUrlResult =
  | { ok: true; url: URL; source: LauncherUrlSource }
  | { ok: false; reason: string };

export interface LauncherUrlInputs {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  /** Contents of app-config.json, or undefined when the file is absent. */
  appConfig: unknown;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** https anywhere; plain http only on loopback, for local development of the launcher. */
function parseLauncherUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol === "https:") return url;
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return url;
  return null;
}

function fromAppConfig(config: unknown): string | undefined {
  if (typeof config !== "object" || config === null) return undefined;
  const value = (config as { launcherUrl?: unknown }).launcherUrl;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * Picks the launcher URL: the --launcher-url= flag, then KOLTO_LAUNCHER_URL, then app-config.json.
 * The first source that is set wins; if its value is not an acceptable URL the result is an error
 * rather than a silent fall-through, so a typo is not masked by a lower-priority source.
 */
export function resolveLauncherUrl(inputs: LauncherUrlInputs): LauncherUrlResult {
  const flag = inputs.argv.find((arg) => arg.startsWith(CLI_FLAG));
  const envValue = inputs.env[ENV_VAR]?.trim();
  const candidates: Array<[LauncherUrlSource, string | undefined]> = [
    ["cli", flag?.slice(CLI_FLAG.length).trim()],
    ["env", envValue === "" ? undefined : envValue],
    ["app-config", fromAppConfig(inputs.appConfig)],
  ];
  for (const [source, raw] of candidates) {
    if (raw === undefined || raw === "") continue;
    const url = parseLauncherUrl(raw);
    if (url === null) {
      return { ok: false, reason: `The launcher URL from ${source} is not https (or http on localhost): ${raw}` };
    }
    return { ok: true, url, source };
  }
  return { ok: false, reason: "No launcher URL is configured." };
}
