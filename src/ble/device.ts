import {
  BLEND_PROFILE,
  BLEND_STATUS,
  BLENDER_SERVICE,
  MOTOR_STATUS,
  REQUEST_OPTIONS,
  encodeProgram,
  SCALE_SERVICE,
  SCALE_WEIGHT,
  parseCup,
  parseMotor,
  parseWeight,
  programSeconds,
  toHex,
  type CupState,
  type MotorState,
  type Step,
} from "./protocol";

export type LogDir = "in" | "out" | "info" | "error";

export interface LogEntry {
  t: number;
  dir: LogDir;
  source: string;
  text: string;
}

export interface CharInfo {
  service: string;
  uuid: string;
  props: string[];
}

export interface DeviceEvents {
  weight: (raw: number) => void;
  cup: (state: CupState, byte: number) => void;
  motor: (state: MotorState, byte: number) => void;
  log: (entry: LogEntry) => void;
  disconnect: () => void;
}

type Listeners = { [K in keyof DeviceEvents]: Set<DeviceEvents[K]> };

/** What the UI talks to. The real blender and the demo both implement it. */
export abstract class Blender {
  abstract readonly name: string;
  abstract readonly demo: boolean;
  abstract writeProgram(steps: Step[]): Promise<void>;
  abstract readWeight(): Promise<number>;
  abstract disconnect(): void;
  abstract listCharacteristics(): Promise<CharInfo[]>;
  abstract writeRaw(service: string, uuid: string, bytes: Uint8Array<ArrayBuffer>): Promise<void>;
  abstract readRaw(service: string, uuid: string): Promise<Uint8Array>;

  private listeners: Listeners = {
    weight: new Set(),
    cup: new Set(),
    motor: new Set(),
    log: new Set(),
    disconnect: new Set(),
  };

  on<K extends keyof DeviceEvents>(event: K, fn: DeviceEvents[K]): () => void {
    this.listeners[event].add(fn);
    return () => this.listeners[event].delete(fn);
  }

  protected emit<K extends keyof DeviceEvents>(event: K, ...args: Parameters<DeviceEvents[K]>) {
    for (const fn of this.listeners[event]) (fn as (...a: unknown[]) => void)(...args);
  }

  protected log(dir: LogDir, source: string, text: string) {
    this.emit("log", { t: Date.now(), dir, source, text });
  }
}

export const bluetoothAvailable = () =>
  typeof navigator !== "undefined" && "bluetooth" in navigator;

const short = (uuid: string) => uuid.slice(0, 8);

/* ------------------------------------------------------------------
   The real thing
   ------------------------------------------------------------------ */

export class BalanceBlender extends Blender {
  readonly demo = false;
  private profileChar: BluetoothRemoteGATTCharacteristic | null = null;
  private weightChar: BluetoothRemoteGATTCharacteristic | null = null;

  private constructor(private device: BluetoothDevice) {
    super();
  }

  get name() {
    return this.device.name ?? "Balance";
  }

  static async request(): Promise<BalanceBlender> {
    const device = await navigator.bluetooth.requestDevice(REQUEST_OPTIONS);
    const blender = new BalanceBlender(device);
    await blender.connect();
    return blender;
  }

  private async connect() {
    this.device.addEventListener("gattserverdisconnected", () => {
      this.log("info", "gatt", "disconnected");
      this.emit("disconnect");
    });
    const server = await this.device.gatt!.connect();
    this.log("info", "gatt", `connected to ${this.name}`);

    // Each service is optional: a firmware without one should still give us
    // whatever the other one offers, and the log will say what was missing.
    try {
      const scale = await server.getPrimaryService(SCALE_SERVICE);
      this.weightChar = await scale.getCharacteristic(SCALE_WEIGHT);
      this.weightChar.addEventListener("characteristicvaluechanged", (e) => {
        const view = (e.target as BluetoothRemoteGATTCharacteristic).value!;
        this.emit("weight", parseWeight(view));
      });
      await this.weightChar.startNotifications();
      this.emit("weight", parseWeight(await this.weightChar.readValue()));
    } catch (err) {
      this.log("error", "scale", String(err));
    }

    try {
      const blender = await server.getPrimaryService(BLENDER_SERVICE);
      const status = await blender.getCharacteristic(BLEND_STATUS);
      status.addEventListener("characteristicvaluechanged", (e) => {
        const b = (e.target as BluetoothRemoteGATTCharacteristic).value!.getUint8(0);
        this.log("in", short(BLEND_STATUS), toHex([b]));
        this.emit("cup", parseCup(b), b);
      });
      const s = (await status.readValue()).getUint8(0);
      this.emit("cup", parseCup(s), s);
      await status.startNotifications();

      const motor = await blender.getCharacteristic(MOTOR_STATUS);
      motor.addEventListener("characteristicvaluechanged", (e) => {
        const b = (e.target as BluetoothRemoteGATTCharacteristic).value!.getUint8(0);
        this.log("in", short(MOTOR_STATUS), toHex([b]));
        this.emit("motor", parseMotor(b), b);
      });
      const m = (await motor.readValue()).getUint8(0);
      this.emit("motor", parseMotor(m), m);
      await motor.startNotifications();

      this.profileChar = await blender.getCharacteristic(BLEND_PROFILE);
    } catch (err) {
      this.log("error", "blender", String(err));
    }
  }

  async writeProgram(steps: Step[]) {
    if (!this.profileChar) throw new Error("Program characteristic not available");
    const bytes = encodeProgram(steps);
    await this.profileChar.writeValue(bytes);
    this.log("out", short(BLEND_PROFILE), `${toHex(bytes)}  (${programSeconds(steps)}s)`);
  }

  async readWeight() {
    if (!this.weightChar) throw new Error("Scale not available");
    return parseWeight(await this.weightChar.readValue());
  }

  disconnect() {
    this.device.gatt?.disconnect();
  }

  async listCharacteristics(): Promise<CharInfo[]> {
    const server = this.device.gatt!;
    const out: CharInfo[] = [];
    for (const svc of await server.getPrimaryServices()) {
      for (const c of await svc.getCharacteristics()) {
        const p = c.properties;
        const props = (
          ["read", "write", "writeWithoutResponse", "notify", "indicate"] as const
        ).filter((k) => p[k]);
        out.push({ service: svc.uuid, uuid: c.uuid, props: [...props] });
      }
    }
    return out;
  }

  private async char(service: string, uuid: string) {
    const svc = await this.device.gatt!.getPrimaryService(service);
    return svc.getCharacteristic(uuid);
  }

  async writeRaw(service: string, uuid: string, bytes: Uint8Array<ArrayBuffer>) {
    await (await this.char(service, uuid)).writeValue(bytes);
    this.log("out", short(uuid), toHex(bytes));
  }

  async readRaw(service: string, uuid: string) {
    const v = await (await this.char(service, uuid)).readValue();
    const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    this.log("in", short(uuid), toHex(bytes));
    return bytes;
  }
}

/* ------------------------------------------------------------------
   Demo

   A pretend base for trying the app without the blender. Its scale
   reads in the same raw counts as the real one appears to (a few
   hundred counts per gram is a guess, which is the point: the
   calibration flow has to work whatever the number is).
   ------------------------------------------------------------------ */

const DEMO_COUNTS_PER_GRAM = 412.7;
const DEMO_EMPTY = -18_430;

export class DemoBlender extends Blender {
  readonly demo = true;
  readonly name = "Demo base";
  private grams = 0;
  private target = 0;
  private timer: number;
  private run: number | null = null;
  private steps: Step[] = [{ q: 180, speed: 0xa0 }];
  private cup: CupState = "empty";

  constructor() {
    super();
    this.log("info", "demo", "demo base connected");
    this.timer = window.setInterval(() => this.tick(), 100);
    queueMicrotask(() => {
      this.emit("cup", "empty", 0);
      this.emit("motor", "off", 0);
    });
  }

  private tick() {
    // Settle towards the target like a pour does, with load-cell noise.
    this.grams += (this.target - this.grams) * 0.25;
    const noise = (Math.random() - 0.5) * 0.6;
    this.emit("weight", Math.round(DEMO_EMPTY + (this.grams + noise) * DEMO_COUNTS_PER_GRAM));
  }

  /** Demo only: put something on, or take it off. */
  pour(grams: number) {
    this.target = Math.max(0, this.target + grams);
  }

  /** Demo only: lock or unlock the cup. */
  toggleCup() {
    if (this.cup === "running") {
      this.stopRun("empty");
      return;
    }
    if (this.cup === "empty") {
      this.setCup("running", 3);
      this.emit("motor", "on", 1);
      const ms = programSeconds(this.steps) * 1000;
      this.run = window.setTimeout(() => this.stopRun("done"), ms);
    } else {
      this.setCup("empty", 0);
    }
  }

  private stopRun(next: CupState) {
    if (this.run) clearTimeout(this.run);
    this.run = null;
    this.emit("motor", "off", 0);
    this.setCup(next, next === "done" ? 2 : 0);
  }

  private setCup(state: CupState, byte: number) {
    this.cup = state;
    this.log("in", short(BLEND_STATUS), toHex([byte]));
    this.emit("cup", state, byte);
  }

  async writeProgram(steps: Step[]) {
    this.steps = steps;
    this.log("out", short(BLEND_PROFILE), `${toHex(encodeProgram(steps))}  (${programSeconds(steps)}s)`);
  }

  async readWeight() {
    return Math.round(DEMO_EMPTY + this.grams * DEMO_COUNTS_PER_GRAM);
  }

  disconnect() {
    clearInterval(this.timer);
    if (this.run) clearTimeout(this.run);
    this.emit("disconnect");
  }

  async listCharacteristics(): Promise<CharInfo[]> {
    return [
      { service: SCALE_SERVICE, uuid: SCALE_WEIGHT, props: ["read", "notify"] },
      { service: BLENDER_SERVICE, uuid: BLEND_STATUS, props: ["read", "notify"] },
      { service: BLENDER_SERVICE, uuid: MOTOR_STATUS, props: ["read", "notify"] },
      { service: BLENDER_SERVICE, uuid: BLEND_PROFILE, props: ["write"] },
    ];
  }

  async writeRaw(_service: string, uuid: string, bytes: Uint8Array<ArrayBuffer>) {
    this.log("out", short(uuid), toHex(bytes));
  }

  async readRaw(_service: string, uuid: string) {
    this.log("in", short(uuid), "00");
    return new Uint8Array([0]);
  }
}
