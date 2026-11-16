import { readFileSync } from "node:fs";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, session, shell, type IpcMainInvokeEvent } from "electron";
import type { Channel, PickedFolder } from "../shared/api";
import { NativeGameFolder } from "./game-source";
import { resolveLauncherUrl } from "./launcher-url";
import { isLauncherUrl, isSafeExternalUrl } from "./navigation";

// Compiled to dist/main/main.js, so the repository (or app.asar) root is two levels up.
const STATIC_DIR = path.join(__dirname, "..", "..", "static");
const PRELOAD = path.join(__dirname, "..", "preload", "preload.js");
const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 800;

let mainWindow: BrowserWindow | null = null;
let launcherOrigin: string | null = null;
let gameFolder: NativeGameFolder | null = null;

function readAppConfig(): unknown {
  try {
    return JSON.parse(readFileSync(path.join(app.getAppPath(), "app-config.json"), "utf8"));
  } catch {
    return undefined;
  }
}

function openExternally(target: string): void {
  if (isSafeExternalUrl(target)) void shell.openExternal(target);
}

/** IPC is answered only for the main window's top frame while it shows the launcher origin. */
function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame;
  const trusted =
    mainWindow !== null &&
    event.sender === mainWindow.webContents &&
    frame !== null &&
    frame.parent === null &&
    launcherOrigin !== null &&
    isLauncherUrl(frame.url, launcherOrigin);
  if (!trusted) throw new Error("Untrusted IPC sender");
}

function requireFolder(): NativeGameFolder {
  if (!gameFolder) throw new Error("No game folder has been picked");
  return gameFolder;
}

function handle(channel: Channel, fn: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event);
    return fn(event, ...args);
  });
}

function asPath(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("path must be a string");
  return value;
}

function registerIpc(): void {
  handle("kolto:pick-game-folder", async (): Promise<PickedFolder | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose your game folder",
      properties: ["openDirectory"],
    });
    const picked = result.filePaths[0];
    if (result.canceled || picked === undefined) return null;
    const root = await realpath(picked);
    gameFolder = new NativeGameFolder(root);
    return { name: path.basename(root) };
  });
  handle("kolto:fs:list", (_e, dir) => requireFolder().list(asPath(dir)));
  handle("kolto:fs:stat", (_e, p) => requireFolder().stat(asPath(p)));
  handle("kolto:fs:open", (_e, p) => requireFolder().open(asPath(p)));
}

function hardenSessions(): void {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
}

function hardenWebContents(): void {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      openExternally(url);
      return { action: "deny" };
    });
    const guard = (event: Electron.Event, url: string): void => {
      if (launcherOrigin !== null && isLauncherUrl(url, launcherOrigin)) return;
      event.preventDefault();
      openExternally(url);
    };
    contents.on("will-navigate", guard);
    contents.on("will-redirect", guard);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    title: "Kolto Desktop",
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const resolved = resolveLauncherUrl({ argv: process.argv, env: process.env, appConfig: readAppConfig() });
  if (resolved.ok) {
    launcherOrigin = resolved.url.origin;
    void mainWindow.loadURL(resolved.url.href);
  } else {
    console.error(resolved.reason);
    void mainWindow.loadFile(path.join(STATIC_DIR, "not-configured.html"));
  }
}

app.enableSandbox();
hardenWebContents();

void app.whenReady().then(() => {
  hardenSessions();
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
