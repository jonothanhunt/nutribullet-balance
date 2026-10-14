import { useCallback, useEffect, useRef, useState } from "react";
import { BalanceBlender, Blender, DemoBlender, type LogEntry } from "../ble/device";
import { programSeconds, type CupState, type MotorState, type Step } from "../ble/protocol";
import { CUSTOM_DEFAULT, PROGRAMS } from "../data/programs";
import { useStored } from "./store";

export interface Calibration {
  /** Raw counts with nothing on the base. */
  zero: number;
  /** Raw counts per gram. Negative if the load cell is wired backwards. */
  perGram: number;
}

export type Link = "idle" | "connecting" | "connected" | "lost";

/** Samples kept for smoothing and for deciding the reading has settled. */
const WINDOW_MS = 700;
/** Settled: everything in the window within this many grams. */
const STABLE_G = 2;

export function useBalance() {
  const [blender, setBlender] = useState<Blender | null>(null);
  const [link, setLink] = useState<Link>("idle");
  const [error, setError] = useState<string | null>(null);

  const [raw, setRaw] = useState<number | null>(null);
  const [spread, setSpread] = useState<number | null>(null);
  const samples = useRef<{ t: number; v: number }[]>([]);

  const [cal, setCal] = useStored<Calibration | null>("balance.calibration", null);
  const [demoCal, setDemoCal] = useState<Calibration | null>(null);
  const [tareRaw, setTareRaw] = useState<number | null>(null);

  const [cup, setCup] = useState<CupState>("unknown");
  const [motor, setMotor] = useState<MotorState>("unknown");
  const [runStart, setRunStart] = useState<number | null>(null);

  const [log, setLog] = useState<LogEntry[]>([]);

  const [programId, setProgramId] = useStored("balance.program", "standard");
  const [custom, setCustom] = useStored<Step[]>("balance.custom", CUSTOM_DEFAULT);
  const steps = programId === "custom" ? custom : (PROGRAMS.find((p) => p.id === programId) ?? PROGRAMS[0]).steps;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const [runSteps, setRunSteps] = useState<Step[]>(steps);

  // The demo base gets its own calibration so trying it never overwrites the
  // real one.
  const isDemo = blender?.demo ?? false;
  const activeCal = isDemo ? demoCal : cal;
  const setActiveCal = isDemo ? setDemoCal : setCal;

  const pushLog = useCallback((e: LogEntry) => {
    setLog((l) => (l.length > 400 ? [...l.slice(-300), e] : [...l, e]));
  }, []);

  const attach = useCallback(
    (b: Blender) => {
      b.on("log", pushLog);
      b.on("weight", (v) => {
        const now = performance.now();
        const s = samples.current;
        s.push({ t: now, v });
        while (s.length && now - s[0].t > WINDOW_MS) s.shift();
        const avg = s.reduce((a, x) => a + x.v, 0) / s.length;
        setRaw(avg);
        const vals = s.map((x) => x.v);
        setSpread(s.length >= 3 ? Math.max(...vals) - Math.min(...vals) : null);
      });
      b.on("cup", (state) => {
        setCup(state);
        if (state === "running") {
          setRunStart(Date.now());
          setRunSteps(stepsRef.current);
        } else setRunStart(null);
      });
      b.on("motor", setMotor);
      b.on("disconnect", () => {
        setLink((l) => (l === "connected" ? "lost" : l));
        setCup("unknown");
        setMotor("unknown");
        setRunStart(null);
      });
      setBlender(b);
      setLink("connected");
      setError(null);
      // Always tell a fresh connection what we have selected; the base keeps
      // whatever it was last sent, which might be someone else's program.
      b.writeProgram(stepsRef.current).catch((e) => setError(String(e.message ?? e)));
    },
    [pushLog],
  );

  const connect = useCallback(async () => {
    setLink("connecting");
    setError(null);
    try {
      attach(await BalanceBlender.request());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLink(blender ? "lost" : "idle");
      // Closing the picker is not an error worth shouting about.
      if (!/cancelled|canceled/i.test(msg)) setError(msg);
    }
  }, [attach, blender]);

  const startDemo = useCallback(() => {
    blender?.disconnect();
    samples.current = [];
    attach(new DemoBlender());
  }, [attach, blender]);

  const disconnect = useCallback(() => {
    blender?.disconnect();
    setBlender(null);
    setLink("idle");
    setRaw(null);
    setTareRaw(null);
    samples.current = [];
  }, [blender]);

  // Selecting a program sends it straight away, unless the motor is running:
  // a mid-blend write has never been tested and is not worth finding out on.
  useEffect(() => {
    if (!blender || link !== "connected" || cup === "running") return;
    // Debounced: dragging a custom step's slider would otherwise write on
    // every pixel.
    const id = setTimeout(
      () => blender.writeProgram(stepsRef.current).catch((e) => setError(String(e.message ?? e))),
      250,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, JSON.stringify(custom)]);

  const grams =
    raw != null && activeCal ? (raw - (tareRaw ?? activeCal.zero)) / activeCal.perGram : null;

  const tare = useCallback(() => {
    if (raw != null) setTareRaw(raw);
  }, [raw]);

  const clearTare = useCallback(() => setTareRaw(null), []);

  return {
    blender,
    link,
    error,
    setError,
    connect,
    startDemo,
    disconnect,
    raw,
    grams,
    stable: spread != null && activeCal != null && spread < Math.abs(activeCal.perGram) * STABLE_G,
    tared: tareRaw != null,
    tare,
    clearTare,
    calibration: activeCal,
    setCalibration: (c: Calibration | null) => {
      setActiveCal(c);
      setTareRaw(null);
    },
    cup,
    motor,
    runStart,
    runSteps,
    runSeconds: programSeconds(runSteps),
    programId,
    setProgramId,
    steps,
    custom,
    setCustom,
    log,
    clearLog: () => setLog([]),
  };
}

export type Balance = ReturnType<typeof useBalance>;
