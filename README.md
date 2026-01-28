# CueCast – Open Source Desktop Soundboard

CueCast is a fast, simple desktop soundboard for streamers and podcasters in Lima, Peru. It serves an untapped market with a free, open source alternative to mobile-only tools and paywalled apps.

Upload sounds, assign them to buttons, and trigger audio with your mouse or global hotkeys. Route output to a virtual device for clean capture in OBS/Streamlabs.

## Quick Start
- Prerequisites: Node.js 20+, npm, macOS or Windows.
- Install deps: `npm install`
- Start in dev:
  - Option A (static build): `npm run dev` (builds once, then runs Electron)
  - Option B (Vite dev server + HMR): in one terminal run `npm run dev:renderer`, in another run `VITE_DEV_SERVER_URL=http://localhost:5173 npm run dev`
- Build TS only: `npm run build-ts`
- Package app: `npm run build`

## Using CueCast
- Upload sounds: Click an empty button to choose a file, right‑click any button → Assign Audio File, or drag‑and‑drop `.wav/.mp3/.ogg/.flac` onto a button.
- Trigger sounds: Click buttons or set a hotkey (Right‑click → Set Hotkey). Hotkeys work globally.
- Output device: Use the device dropdown in the header to select a virtual device (e.g., VB‑Audio Cable on Windows, BlackHole on macOS). Selection persists across restarts.

## How It Works
- Audio engine: WebAudio with `latencyHint: "interactive"` and cached buffers for fast playback.
- Output routing: `MediaStreamDestination` feeds a hidden `<audio>` element; `setSinkId(deviceId)` selects devices when supported, otherwise it falls back to the system default.

## Global Hotkeys
- Registered in the Electron main process via `globalShortcut`.
- macOS: You may need to grant Input Monitoring (System Settings → Privacy & Security → Input Monitoring) if hotkeys don’t register.
- Conflicts: If a hotkey can’t register (already used by the OS/another app), CueCast logs a warning and keeps running.

## Config Persistence
- Location: `~/Library/Application Support/CueCast/config.json` (macOS) or `%APPDATA%/CueCast/config.json` (Windows).
- Schema:
  `{ "buttons": [{ "label": string, "path": string|null, "gain": number }], "hotkeys": { [accelerator]: index }, "outputDeviceId": string|null }`
- Corruption handling: If the JSON can’t be parsed at launch, CueCast resets to defaults without crashing.

## Packaging
- `npm run build` compiles TypeScript and invokes electron‑builder.
- Outputs installers under `dist/` per platform configuration.

## Troubleshooting
- No audio on selected device: Ensure a virtual output device is installed and selected; if `setSinkId` isn’t supported on your platform, default device is used.
- Hotkeys not working (macOS): Check Input Monitoring permissions and try re‑assigning the hotkey.
- Drag‑and‑drop issues: Try using Assign Audio File from the context menu.
- Logs: Check the app log under `<userData>/logs/app.log`.
  - macOS: `~/Library/Application Support/CueCast/logs/app.log`
  - Windows: `%APPDATA%\CueCast\logs\app.log`

## Roadmap
See `ROADMAP.md` for planned work and future epics.

## Renderer Stack
- React 18 + React DOM, powered by Vite.
- Entry: `src/renderer/index.html` → `src/renderer/main.tsx` → `src/renderer/App.tsx`.
- IPC bridge exposed via `src/main/preload.ts` as `window.electronAPI` (typed in `src/common/types.ts`).

## Electron Integration Notes
- Main process serves the Vite dev server in dev when `VITE_DEV_SERVER_URL` is set; otherwise it loads the built renderer from `dist/renderer`.
- Global hotkeys are registered in the main process and forwarded to the renderer via IPC.
- Press Cmd/Ctrl+Shift+D in the renderer to cycle console log level (debug/info/warn/error).
