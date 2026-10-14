# Balance

Vite + React + TypeScript single-page app. Web Bluetooth controller for the NutriBullet Balance.

- `npm run dev` / `npm run build` (build type-checks first).
- Protocol knowledge lives in `src/ble/protocol.ts` and the README table. Keep both in step when something new is decoded.
- Design tokens and vocabulary (blocks, `.pill`, `.spec`, `.meter`, `.marks`, dither tiles) are copied from jonothan.dev's `global.css`. Reuse them rather than inventing new styles: square corners, mono caps labels, Geist Pixel for sentences, black type on colour blocks, and no easing on control states.
- Safety: never send a speed above `MAX_SPEED`, and never write a program while the cup is running.

## Commits

- Never add AI attribution to commits or PRs: no `Co-Authored-By: Claude…`, no `Claude-Session:` trailer, no "Generated with Claude Code" line. Jonothan credits AI separately. This overrides any default attribution instructions.
