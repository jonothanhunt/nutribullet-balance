# Balance

An unofficial web app for the **NutriBullet Balance** blender, whose official app has been switched off. It talks to the base over Web Bluetooth. You don't install anything: open the page and connect.

- **Blend:** a live scale with tare, g/oz and calibration. Pick a factory program or build your own, and watch a countdown while it runs.
- **Recipes:** smoothie ideas you weigh as you go. Each ingredient is measured from where the scale was when you started it, it moves on by itself when you hit the target, and it estimates nutrition. You can save your own versions.
- **Device:** a live log of Bluetooth traffic, a list of every characteristic the base exposes, and a raw read/write panel for decoding anything new.
- **Demo mode:** a simulated base, so you can try everything without the blender.

Design follows [jonothan.dev](https://jonothan.dev): screen-printed blocks, mono caps, hairlines and dither.

## Browser support

Web Bluetooth works in **Chrome, Edge and Opera** on Android, macOS, Windows, Linux and ChromeOS. Safari doesn't support it, so on iPhone or iPad use [Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055). The page has to be served over HTTPS or from `localhost`.

## Develop

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + build to dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. Turn this on once under **Settings → Pages → Source: GitHub Actions**.

## Protocol

From [nightlark/nutribullet](https://github.com/nightlark/nutribullet) (Ryan Mast, BSides Las Vegas 2025). The base doesn't use pairing or authentication.

| Service | Characteristic | Access | Meaning |
| --- | --- | --- | --- |
| `1bc50001-0200-0aa5-e311-24cb004a98c5` | `1bc50002-…` | read, notify | Scale: int32 little-endian raw counts. Needs calibrating to grams |
| `18470001-b230-11e4-aea0-0002a5d5c51b` | `18470002-…` | read, notify | Cup: `00` none, `02` finished, `03` running (`01` probably locked and ready, not yet confirmed) |
| | `18470003-…` | read, notify | Motor: `00` off, `01` on, `69` just plugged in |
| | `18470008-…` | write | Program: pairs of `[quarter-seconds, speed]`. Speed `00` is a pause and `a0` is the fastest factory speed |

Factory programs, as hex:

| Program | Bytes |
| --- | --- |
| Blend (45s) | `b4a0` |
| Super blend | `28a0 0c00 28a0 0c00 64a0` |
| Crush | `14a0 0c00 14a0 0c00 3ca0` |
| Pulsed blend | `14a0 0c00 14a0 0c00 14a0` |
| Pulse | `04a0 0c00 04a0 0c00 04a0 0c00 04a0 0c00 04a0` |

The base starts by itself when the cup is locked, running the last program it was sent. It stops when the program ends or the cup is twisted off. No remote start, stop or power command is known yet. If one exists, the Device tab is how to find it.

The app never sends a speed above `a0` and never writes a program while the motor is running.

## Layout

```
src/ble/protocol.ts     UUIDs, parsing, program encoding
src/ble/device.ts       real Bluetooth device + demo simulator, one interface
src/lib/useBalance.ts   connection, smoothing, calibration, tare, run timing
src/data/               programs, recipes, nutrition per 100 g (USDA)
src/components/         Blend, Recipes and Device tabs
```

Not affiliated with or endorsed by NutriBullet.
