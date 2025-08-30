# CueCast – Electron Soundboard (Epic 1)

CueCast is a fast, simple desktop soundboard for streamers. Assign audio to buttons, trigger via clicks or global hotkeys, and route output to a virtual device for clean capture in OBS/Streamlabs.

## Quick Start
- Prerequisites: Node.js 20+, npm, macOS or Windows.
- Install deps: `npm install`
- Start in dev: `npm run dev`
- Build TS only: `npm run build-ts`
- Package app: `npm run build`

## Using CueCast
- Assign sounds: Click an empty button to choose a file, right‑click any button → Assign Audio File, or drag‑and‑drop `.wav/.mp3/.ogg/.flac` onto a button.
- Trigger sounds: Click buttons or set a hotkey (Right‑click → Set Hotkey). Hotkeys work globally.
- Output device: Use the device dropdown in the header to select a virtual device (e.g., VB‑Audio Cable on Windows, BlackHole on macOS). Selection persists across restarts.

## Audio Routing Details
- Low‑latency playback: WebAudio with `latencyHint: "interactive"` and buffer caching.
- Device routing: Audio graph uses `MediaStreamDestination` piped to a hidden `<audio>` element. When supported, the element’s `setSinkId(deviceId)` selects the output device.
- Fallbacks: If `setSinkId` is unavailable or fails, CueCast falls back to the system default device and shows a status message.

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

## Roadmap (Post‑Epic 1)
- Banks/profiles, per‑button color and gain UI, MIDI input, OBS integration, and cloud sync in future epics.
