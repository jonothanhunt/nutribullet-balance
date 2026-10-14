import { useEffect, useState } from "react";
import { DemoBlender, bluetoothAvailable } from "../ble/device";
import { MAX_STEPS, MIN_SPEED, MAX_SPEED, programSeconds, speedPct, type Step } from "../ble/protocol";
import { PROGRAMS } from "../data/programs";
import type { Balance } from "../lib/useBalance";
import { Sheet, Spec, Timeline, fmtSeconds, fmtWeight, type Unit } from "./ui";

export function useNow(active: boolean, ms = 100) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

export function BlendTab({ b, unit, setUnit }: { b: Balance; unit: Unit; setUnit: (u: Unit) => void }) {
  const [sheet, setSheet] = useState<"calibrate" | "custom" | null>(null);

  return (
    <div className="stack">
      <ScaleBlock b={b} unit={unit} setUnit={setUnit} onCalibrate={() => setSheet("calibrate")} />
      <StatusBlock b={b} />

      <div className="section-head">
        <span className="label">Program</span>
      </div>
      <div className="grid grid--3">
        {PROGRAMS.map((p) => (
          <button
            key={p.id}
            className={`block block--${p.ink} prog${b.programId === p.id ? " prog--on" : ""}`}
            onClick={() => b.setProgramId(p.id)}
            aria-pressed={b.programId === p.id}
          >
            <div className="prog__name">
              <h3>{p.name}</h3>
              <span className="check">✓</span>
            </div>
            <Timeline steps={p.steps} />
            <Spec label="Time">{fmtSeconds(programSeconds(p.steps))}</Spec>
          </button>
        ))}
        <button
          className={`block block--paper framed prog prog--paper${b.programId === "custom" ? " prog--on" : ""}`}
          onClick={() => {
            b.setProgramId("custom");
            setSheet("custom");
          }}
          aria-pressed={b.programId === "custom"}
        >
          <div className="prog__name">
            <h3>Custom</h3>
            <span className="check">✓</span>
          </div>
          <Timeline steps={b.custom} />
          <Spec label="Time">{fmtSeconds(programSeconds(b.custom))}</Spec>
        </button>
      </div>

      {sheet === "calibrate" && <CalibrateSheet b={b} onClose={() => setSheet(null)} />}
      {sheet === "custom" && <CustomSheet b={b} onClose={() => setSheet(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ScaleBlock({
  b,
  unit,
  setUnit,
  onCalibrate,
}: {
  b: Balance;
  unit: Unit;
  setUnit: (u: Unit) => void;
  onCalibrate: () => void;
}) {
  const connected = b.link === "connected";
  const w = b.grams != null ? fmtWeight(b.grams, unit) : null;

  return (
    <section className="block block--paper framed marks scale" aria-label="Scale">
      <div className="scale__top">
        <span className="label">Scale</span>
        <span className={`label settle${b.stable ? " settle--on" : ""}`}>
          {!connected ? "Offline" : !b.calibration ? "Uncalibrated" : b.stable ? "Settled" : "Reading"}
        </span>
      </div>

      {connected && w ? (
        <div className="readout" aria-live="polite">
          <span className="readout__n">{w.n}</span>
          <span className="readout__u">{w.u}</span>
        </div>
      ) : connected && b.raw != null ? (
        <div className="readout readout--raw readout--dim">
          <span className="readout__n">{Math.round(b.raw)}</span>
          <span className="readout__u">raw</span>
        </div>
      ) : (
        <div className="readout readout--dim">
          <span className="readout__n">0</span>
          <span className="readout__u">{unit}</span>
        </div>
      )}

      <div className="dither-band" style={{ margin: "14px 0" }} />

      <div className="row">
        {b.calibration ? (
          <>
            <button className="pill pill--ink" onClick={b.tare} disabled={!connected}>
              Tare
            </button>
            <button className="pill" onClick={() => setUnit(unit === "g" ? "oz" : "g")}>
              {unit === "g" ? "g → oz" : "oz → g"}
            </button>
            <button className="pill" onClick={onCalibrate} disabled={!connected}>
              Calibrate
            </button>
          </>
        ) : (
          <button className="pill pill--ink" onClick={onCalibrate} disabled={!connected}>
            Calibrate the scale
          </button>
        )}
      </div>
      {b.tared && (
        <div style={{ marginTop: 10 }}>
          <button className="label label--soft" onClick={b.clearTare}>
            Clear tare
          </button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function StatusBlock({ b }: { b: Balance }) {
  const running = b.cup === "running" && b.runStart != null;
  const now = useNow(running);
  const demo = b.blender instanceof DemoBlender ? b.blender : null;
  const selected = b.programId === "custom" ? "Custom" : PROGRAMS.find((p) => p.id === b.programId)?.name;

  if (b.link !== "connected") {
    return (
      <section className="block block--ink status">
        <h2 style={{ marginTop: 0 }}>{b.link === "lost" ? "Disconnected" : b.link === "connecting" ? "Connecting…" : "Not connected"}</h2>
        {!bluetoothAvailable() && <p className="label" style={{ marginBottom: 12 }}>No Bluetooth in this browser</p>}
        <div className="row" style={{ marginTop: 16 }}>
          <button
            className="pill"
            style={{ background: "var(--sun)", color: "var(--ink-fixed)", boxShadow: "none" }}
            onClick={b.connect}
            disabled={!bluetoothAvailable() || b.link === "connecting"}
          >
            {b.link === "lost" ? "Reconnect" : "Connect"}
          </button>
          <button className="pill" style={{ boxShadow: "inset 0 0 0 1px rgb(var(--paper-rgb) / 0.4)" }} onClick={b.startDemo}>
            Demo
          </button>
        </div>
        {b.error && (
          <p className="label" style={{ marginTop: 12, color: "var(--flame)" }}>
            {b.error}
          </p>
        )}
      </section>
    );
  }

  if (running) {
    const elapsed = (now - b.runStart!) / 1000;
    const left = Math.max(0, b.runSeconds - elapsed);
    return (
      <section className="block block--flame status status--running" aria-live="polite">
        <Spec label="Blending">{selected}</Spec>
        <div className="status__time" style={{ margin: "14px 0" }}>
          {fmtSeconds(Math.ceil(left))}
        </div>
        <Timeline steps={b.runSteps} progress={Math.min(1, elapsed / b.runSeconds)} big />
        {demo && <DemoControls demo={demo} cupLabel="Twist off (demo)" />}
      </section>
    );
  }

  if (b.cup === "done") {
    return (
      <section className="block block--leaf status">
        <h2 style={{ marginTop: 0 }}>Done</h2>
        {demo && <DemoControls demo={demo} cupLabel="Twist off (demo)" />}
      </section>
    );
  }

  return (
    <section className="block block--sun status marks">
      <Spec label="Ready">{selected} · {fmtSeconds(programSeconds(b.steps))}</Spec>
      <h2 style={{ marginBottom: 0 }}>Lock cup to start</h2>
      {demo && <DemoControls demo={demo} cupLabel="Lock cup (demo)" />}
    </section>
  );
}

function DemoControls({ demo, cupLabel }: { demo: DemoBlender; cupLabel: string }) {
  return (
    <div className="row" style={{ marginTop: 14 }}>
      <button className="pill pill--fixed pill--on" onClick={() => demo.toggleCup()}>
        {cupLabel}
      </button>
      <button className="pill pill--fixed" onClick={() => demo.pour(100)}>
        +100g
      </button>
      <button className="pill pill--fixed" onClick={() => demo.pour(-1e6)}>
        Clear
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CalibrateSheet({ b, onClose }: { b: Balance; onClose: () => void }) {
  const [stage, setStage] = useState<"zero" | "known" | "done">("zero");
  const [zero, setZero] = useState<number | null>(null);
  const [known, setKnown] = useState("500");
  const [err, setErr] = useState<string | null>(null);

  const captureZero = () => {
    if (b.raw == null) return;
    setZero(b.raw);
    setStage("known");
  };

  const captureKnown = () => {
    const g = parseFloat(known);
    if (b.raw == null || zero == null || !(g > 0)) return;
    const perGram = (b.raw - zero) / g;
    // A real load cell moves by many counts per gram. A tiny delta means
    // nothing was put on, or it was put on before zeroing.
    if (Math.abs(perGram) < 0.5) {
      setErr("No change detected");
      return;
    }
    b.setCalibration({ zero, perGram });
    setStage("done");
  };

  return (
    <Sheet title="Calibrate" onClose={onClose}>
      <div className="stack">
        <Spec label="Live">{b.raw != null ? Math.round(b.raw) : "—"}</Spec>
        {b.blender instanceof DemoBlender && (
          <div className="row">
            <button className="pill" onClick={() => (b.blender as DemoBlender).pour(500)}>
              Demo: put 500 g on
            </button>
          </div>
        )}

        {stage === "zero" && (
          <>
            <h3>1 · Empty base</h3>
            <button className="pill pill--ink pill--block" onClick={captureZero} disabled={b.raw == null}>
              Set zero
            </button>
          </>
        )}

        {stage === "known" && (
          <>
            <h3>2 · Known weight</h3>
            <div className="row" style={{ alignItems: "center", gap: 10 }}>
              <input
                className="field field--num"
                inputMode="decimal"
                value={known}
                onChange={(e) => setKnown(e.target.value)}
                aria-label="Known weight in grams"
              />
              <span className="label">grams</span>
            </div>
            <button className="pill pill--ink pill--block" onClick={captureKnown}>
              Set
            </button>
            {err && <p className="label" style={{ color: "var(--flame)" }}>{err}</p>}
          </>
        )}

        {stage === "done" && (
          <>
            <h3>Calibrated</h3>
            <button className="pill pill--ink pill--block" onClick={onClose}>
              Done
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

const SPEED_STEP = 0x10;

function CustomSheet({ b, onClose }: { b: Balance; onClose: () => void }) {
  const steps = b.custom;
  const set = (i: number, patch: Partial<Step>) =>
    b.setCustom(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <Sheet title="Custom program" onClose={onClose}>
      <Timeline steps={steps} big />
      <div style={{ marginTop: 12 }}>
        <Spec label="Total">{fmtSeconds(programSeconds(steps))}</Spec>
      </div>
      <div style={{ marginTop: 14 }}>
        {steps.map((s, i) => (
          <div className="step" key={i}>
            <span className="step__n">{String(i + 1).padStart(2, "0")}</span>
            <div className="step__ctl">
              <Spec label={s.speed === 0 ? "Pause" : `Speed ${speedPct(s.speed)}%`}>{s.q / 4}s</Spec>
              <label className="slider">
                <span className="label label--soft">Spd</span>
              <input
                type="range"
                min={0}
                max={MAX_SPEED}
                step={SPEED_STEP}
                value={s.speed}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  set(i, { speed: v === 0 ? 0 : Math.max(MIN_SPEED, v) });
                }}
                aria-label={`Step ${i + 1} speed`}
              />
              </label>
              <label className="slider">
                <span className="label label--soft">Sec</span>
              <input
                type="range"
                min={1}
                max={60}
                value={s.q / 4}
                onChange={(e) => set(i, { q: Number(e.target.value) * 4 })}
                aria-label={`Step ${i + 1} seconds`}
              />
              </label>
            </div>
            <button
              className="pill"
              onClick={() => b.setCustom(steps.filter((_, j) => j !== i))}
              disabled={steps.length <= 1}
              aria-label={`Remove step ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="pill"
          onClick={() => b.setCustom([...steps, { q: 12, speed: 0 }])}
          disabled={steps.length >= MAX_STEPS}
        >
          + Pause
        </button>
        <button
          className="pill"
          onClick={() => b.setCustom([...steps, { q: 20, speed: MAX_SPEED }])}
          disabled={steps.length >= MAX_STEPS}
        >
          + Blend
        </button>
      </div>
    </Sheet>
  );
}
