# swkotor-desktop

Status: scaffold. No code yet.

The desktop shell: an Electron app that opens the `swkotor-web` launcher and gives the runtime direct,
read-only access to the user's installed game.

## Responsibility

- Load a pinned build of `swkotor-web`. It contains no launcher UI of its own.
- Provide the `native-fs` `GameSource` from `kotor-runtime-api` through a preload bridge
  (`contextIsolation` on, `nodeIntegration` off).
- Find installed Steam, GOG and disc copies.
- Optionally start `swkotor-service`.
- Package installers.

## Not here

Launcher pages and styles, the runtime, file format parsing.

## Contract

Implements `GameSource` (`kind: "native-fs"`). Consumes the launcher as a built artifact and the
runtime through `kotor-runtime/1`. Will receive `src/electron`, `main.js` and `electron-builder.json`
from `swkotor-web`.

## Where this fits

One of the repos that together run KotOR I and II in the browser. The full map, the contracts and
the roadmap are in [ARCHITECTURE.md](https://github.com/kolto-labs/swkotor-web/blob/master/ARCHITECTURE.md).

No game files are distributed. Bring your own copy of KotOR I or II.
Not affiliated with Lucasfilm, Disney, BioWare, Obsidian or Aspyr.
