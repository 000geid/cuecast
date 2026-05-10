# CueCast – Open Source Desktop Soundboard

CueCast is a fast, simple desktop soundboard for streamers and podcasters in Lima, Peru. It serves an untapped market with a free, open source alternative to mobile-only tools and paywalled apps.

Upload sounds, assign them to buttons, and trigger audio with your mouse or global hotkeys. Route output to a virtual device for clean capture in OBS/Streamlabs.

## Quick Start
- Prerequisites: Node.js 20+, npm, macOS or Windows.
- Install deps: `npm install`
- Start in dev:
  - `npm run dev` starts Vite, TypeScript watch mode, and Electron together.
  - On Linux, the dev Electron process uses `--no-sandbox` to avoid local `chrome-sandbox` permission issues in `node_modules`.
- Build TS only: `npm run build-ts`
- Build app assets only: `npm run build:app`
- Package app for the current OS: `npm run package`

## Using CueCast
- Upload sounds: Click an empty button to choose a file, right‑click any button → Assign Audio File, or drag‑and‑drop `.wav/.mp3/.ogg/.flac` onto a button.
- Trigger sounds: Click buttons or set a hotkey (Right‑click → Set Hotkey). Hotkeys work globally.
- Stop playback: Press `Space` from the main view or click `Stop All` to fade out every active sound.
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
- Local packaging commands:
  - `npm run package` builds the app and creates installers for the current OS.
  - `npm run package:dir` builds an unpacked directory without creating installers.
  - `npm run package:mac` builds `dmg` and `zip` artifacts on macOS.
  - `npm run package:win` builds `nsis` and `portable` artifacts on Windows.
- Compiled app files stay under `dist/`; distributable artifacts are written to `release/`.
- Native targets should be built on native runners:
  - macOS artifacts on macOS.
  - Windows artifacts on Windows.
  - Linux can package AppImage locally, but it cannot produce a signed macOS app.

## Shipping Releases
- GitHub Actions workflow: `.github/workflows/release.yml`
- Triggers:
  - Push a tag like `v0.1.11` to build Linux, macOS, and Windows artifacts and attach them to a GitHub Release.
  - Run the workflow manually with `workflow_dispatch` to build `linux`, `windows`, `macos`, or `all`.
  - Manual runs are build-only by default; publishing a GitHub Release is opt-in with `publish_release=true`.
- Manual Linux-first flow with `gh`:
  - Build only: `gh workflow run .github/workflows/release.yml -f platform=linux`
  - Build and publish: `gh workflow run .github/workflows/release.yml -f platform=linux -f publish_release=true -f release_tag=v0.1.11 -f release_name="CueCast v0.1.11"`
  - `gh run watch`
  - `gh release view v0.1.11`
- Required for smoother public distribution:
  - Windows code signing certificate to reduce SmartScreen warnings.
  - Apple Developer ID signing and notarization to avoid Gatekeeper blocks.
- Recommended first-release checklist:
  - Replace the default Electron app icon with `ico` and `icns` assets.
  - Test install and first launch on a clean Windows machine and a clean macOS machine.
  - Verify global hotkey permission prompts on macOS.

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
