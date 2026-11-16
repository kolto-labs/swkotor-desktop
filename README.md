# swkotor-desktop

The desktop shell: a small Electron app that opens the Kolto launcher web app and gives it
read-only access to a game folder the user picks. Written from scratch; it contains no launcher UI
and no engine code of its own.

## What it does

- Opens the launcher at a configured `https` URL (plain `http` only on localhost, for development).
- Exposes `window.koltoDesktop` to the launcher page through a sandboxed preload:
  - `pickGameFolder()` shows the native folder dialog and returns the folder's name only, never its
    full path.
  - `gameSource` is the `native-fs` `GameSource` from
    [`kotor-runtime-api`](https://github.com/kolto-labs/kotor-runtime-api): `list`, `stat` and
    `open`, all read-only.
- Every path is confined to the picked folder, lexically and again after resolving symlinks, so
  `../` and links that point outside the folder are refused.
- IPC is answered only for the main window's top frame while it shows the launcher origin. Other
  navigation and new windows are blocked; `https` links open in the system browser. All permission
  requests (camera, notifications and so on) are denied.

## Configure the launcher URL

The first source that is set wins:

1. `--launcher-url=https://launcher.example` on the command line.
2. The `KOLTO_LAUNCHER_URL` environment variable.
3. `{"launcherUrl": "https://launcher.example"}` in `app-config.json` at the app root (git-ignored,
   included when packaging).

With none set, or an unacceptable value, the app shows a page explaining how to set it.

## Develop

```sh
npm install
npm run typecheck
npm test
KOLTO_LAUNCHER_URL=http://localhost:5173 npm start
npm run package   # installers into release/
```

## Not here

Launcher pages and styles, the runtime, file format parsing, detection of Steam or GOG installs,
starting the optional background service. Those belong to the other repos; detection and the
service hook may land here later.

## Where this fits

One of the repos that together run KotOR I and II in the browser. The full map, the contracts and
the roadmap are in [ARCHITECTURE.md](https://github.com/kolto-labs/swkotor-web/blob/master/ARCHITECTURE.md).

No game files are distributed. Bring your own copy of KotOR I or II.
Not affiliated with Lucasfilm, Disney, BioWare, Obsidian or Aspyr.

MIT licence.
