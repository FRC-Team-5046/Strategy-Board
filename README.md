# Strategy Board

The Digital Strategy Whiteboard for FRC.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).

## Mobile

Generate both native mobile projects on macOS:

```sh
bun run mobile:init
```

Build both the Android and iOS release artifacts:

```sh
bun run mobile:build
```

The generated projects are written under `src-tauri/gen/android` and
`src-tauri/gen/apple`. Android builds require the Android SDK/NDK; iOS builds
require macOS, Xcode, CocoaPods, and Apple signing for a distributable IPA.

### Offline-only build and embedding

For kiosks, events without internet, or apps that embed the board in a web
view, build with:

```sh
VITE_OFFLINE_ONLY=1 bun run build
```

This hides share-by-code, share-link import, TBA import, the Statbotics tab
and the contributors list. Everything else (drawing, saved matches, QR,
PNG/PDF export) works offline. Serve `build/` from a fixed origin so saved
matches (IndexedDB) persist.

An offline-only build also exposes `window.strategyBoard` for a host app
(see `src/lib/features/embed.ts`):

- `openMatch({ name, red, blue, year? })` opens the board for that match,
  creating it the first time.
- `snapshot(maxWidth?)` returns a PNG data URL of the open board, or `null`.
- `snapshotPhases(maxWidth?)` returns `{ phase, label, png }` for every phase
  with drawing, checkboxes or moved robots (the open phase if none has).
- `setTeamNumber(team)` stores the team number, so the first-run question is
  skipped.
- `setExitHandler(fn)` makes EXIT save and then call `fn` instead of showing
  the match list; `exit()` does the same from the host.

In an offline-only build the field also keeps a gutter at each side, so the
floating colour and tool controls do not cover the driver station labels.
