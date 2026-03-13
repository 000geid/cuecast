# CueCast

Desktop Electron soundboard for streamers and podcasters. Single-package app (not a monorepo).

## Cursor Cloud specific instructions

### Architecture

- **Main process**: `src/main/index.ts` (Electron, IPC, config persistence, global hotkeys)
- **Renderer**: `src/renderer/` (React 18 + Vite)
- **Shared types**: `src/common/types.ts`

### Running the app

See `package.json` scripts. Key commands:

- `npm run dev` — starts Vite dev server, TypeScript watcher, and Electron concurrently
- `npm run build-ts` — compile main process TypeScript
- `npm run build-renderer` — build renderer with Vite
- `npm run build` — full production build + electron-builder packaging
- `npm test` — run Jest (currently no test files exist; use `--passWithNoTests`)

### Dev mode notes

- `npm run dev` uses `concurrently` to start all three processes. `wait-on` blocks Electron launch until both the Vite server (port 5173) and compiled main process JS files are ready.
- Electron runs with `--dev` flag which opens DevTools automatically.
- D-Bus errors (`Failed to connect to the bus`) and GPU errors in the terminal are harmless artifacts of running Electron in a headless Linux environment.
- The Vite CJS deprecation warning is cosmetic and does not affect functionality.

### Linting

No ESLint configuration exists in this project. TypeScript strict mode (`tsc`) is the primary static check.

### Testing

Jest is configured but no test files exist yet. Run `npm test -- --passWithNoTests` to verify the test runner works without failing on zero tests.

### Electron + headless

Electron requires a display server. The Cloud VM has Xvfb pre-installed with `DISPLAY=:1`. No additional setup needed.
