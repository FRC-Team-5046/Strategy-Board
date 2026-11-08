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
