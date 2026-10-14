/**
 * The Nutribullet Balance's Bluetooth protocol, as far as it is known.
 *
 * Everything here comes from nightlark/nutribullet (Ryan Mast's Web Bluetooth
 * controller, BSides Las Vegas 2025) and is unofficial. Anything marked
 * "guess" has not been seen on a real blender yet: the Device tab's log is
 * there to confirm or correct it.
 */

export const SCALE_SERVICE = "1bc50001-0200-0aa5-e311-24cb004a98c5";
/** notify/read: int32 little-endian raw load-cell counts. */
export const SCALE_WEIGHT = "1bc50002-0200-0aa5-e311-24cb004a98c5";

export const BLENDER_SERVICE = "18470001-b230-11e4-aea0-0002a5d5c51b";
/** notify/read: uint8, see CupState. */
export const BLEND_STATUS = "18470002-b230-11e4-aea0-0002a5d5c51b";
/** notify/read: uint8, see MotorState. */
export const MOTOR_STATUS = "18470003-b230-11e4-aea0-0002a5d5c51b";
/** write: the program the motor runs next time the cup is locked. */
export const BLEND_PROFILE = "18470008-b230-11e4-aea0-0002a5d5c51b";

export const REQUEST_OPTIONS: RequestDeviceOptions = {
  filters: [
    { name: "NutriBullet Balance" },
    { namePrefix: "UBN" },
    { services: [SCALE_SERVICE] },
    { services: [BLENDER_SERVICE] },
  ],
  optionalServices: [SCALE_SERVICE, BLENDER_SERVICE],
};

export type CupState = "empty" | "ready" | "running" | "done" | "unknown";

export function parseCup(byte: number): CupState {
  switch (byte) {
    case 0x00:
      return "empty"; // no cup locked in
    case 0x01:
      return "ready"; // guess: cup locked, not running
    case 0x02:
      return "done"; // blend finished, cup still on
    case 0x03:
      return "running";
    default:
      return "unknown";
  }
}

export type MotorState = "off" | "on" | "plugged" | "unknown";

export function parseMotor(byte: number): MotorState {
  switch (byte) {
    case 0x00:
      return "off";
    case 0x01:
      return "on";
    case 0x69:
      return "plugged"; // reported once, just after the base is plugged in
    default:
      return "unknown";
  }
}

export function parseWeight(view: DataView): number {
  return view.getInt32(0, true);
}

/* ------------------------------------------------------------------
   Programs

   A program is a list of steps, each two bytes: duration in quarter
   seconds, then speed. Speed 0x00 is a pause. 0xA0 is the fastest any
   of the factory programs use, and the app never goes above it.
   ------------------------------------------------------------------ */

export interface Step {
  /** Quarter seconds, 1–255. */
  q: number;
  /** 0x00 (pause) to MAX_SPEED. */
  speed: number;
}

export const MAX_SPEED = 0xa0;
export const MIN_SPEED = 0x10;
/** Ten steps is twenty bytes: one write at the default BLE packet size. */
export const MAX_STEPS = 10;

export function encodeProgram(steps: Step[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(steps.length * 2);
  steps.forEach((s, i) => {
    out[i * 2] = clamp(Math.round(s.q), 1, 255);
    out[i * 2 + 1] = s.speed === 0 ? 0 : clamp(Math.round(s.speed), MIN_SPEED, MAX_SPEED);
  });
  return out;
}

export function programSeconds(steps: Step[]): number {
  return steps.reduce((t, s) => t + s.q / 4, 0);
}

export function toHex(bytes: ArrayLike<number>): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
}

export function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  const clean = hex.replace(/[^0-9a-f]/gi, "");
  if (clean.length === 0 || clean.length % 2) return null;
  return new Uint8Array(clean.match(/../g)!.map((b) => parseInt(b, 16)));
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Speed byte as a share of the fastest factory speed, for display. */
export const speedPct = (speed: number) => Math.round((speed / MAX_SPEED) * 100);
