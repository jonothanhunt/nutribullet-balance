import { useEffect, useRef, useState } from "react";
import type { CharInfo } from "../ble/device";
import { fromHex } from "../ble/protocol";
import type { Balance } from "../lib/useBalance";
import { Spec } from "./ui";

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour12: false });
const ARROW = { in: "←", out: "→", info: "·", error: "!" } as const;

export function DeviceTab({ b }: { b: Balance }) {
  const connected = b.link === "connected";
  const [chars, setChars] = useState<CharInfo[] | null>(null);
  const [target, setTarget] = useState<string>("");
  const [hex, setHex] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [b.log.length]);

  useEffect(() => {
    if (!connected) setChars(null);
  }, [connected]);

  const pick = chars?.find((c) => `${c.service}|${c.uuid}` === target);

  const run = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="stack">
      <header>
        <span className="label label--soft">For poking at the protocol</span>
        <h2 style={{ marginTop: 8 }}>Device</h2>
      </header>

      <section className="block block--paper framed marks stack">
        <Spec label="Base">{b.blender?.name ?? "—"}</Spec>
        <Spec label="Link">{b.link}</Spec>
        <Spec label="Cup">{b.cup}</Spec>
        <Spec label="Motor">{b.motor}</Spec>
        <Spec label="Raw scale">{b.raw != null ? Math.round(b.raw) : "—"}</Spec>
        <Spec label="Calibration">
          {b.calibration ? `${b.calibration.perGram.toFixed(2)} counts/g` : "none"}
        </Spec>
        <div className="row">
          {connected ? (
            <button className="pill" onClick={b.disconnect}>
              Disconnect
            </button>
          ) : (
            <button className="pill pill--ink" onClick={b.connect}>
              Connect
            </button>
          )}
          <button className="pill" onClick={() => b.setCalibration(null)} disabled={!b.calibration}>
            Forget calibration
          </button>
        </div>
      </section>

      <div className="section-head">
        <span className="label">Traffic</span>
        <button className="label label--soft" onClick={b.clearLog}>
          Clear
        </button>
      </div>
      <div className="log" ref={logRef} role="log">
        {b.log.length === 0 && <span className="label label--soft">Nothing yet. Connect to see traffic.</span>}
        {b.log.map((e, i) => (
          <div key={i} className={`log__row log__${e.dir}`}>
            <span>{time(e.t)}</span>
            <span>{ARROW[e.dir]}</span>
            <span>{e.source}</span>
            <span>{e.text}</span>
          </div>
        ))}
      </div>
      <p className="label label--soft" style={{ lineHeight: 1.6 }}>
        Scale readings are left out — they arrive several times a second. Copy anything odd here and send it
        over: that's how new features get decoded.
      </p>
      <div className="row">
        <button
          className="pill"
          onClick={() =>
            navigator.clipboard?.writeText(
              b.log.map((e) => `${time(e.t)} ${ARROW[e.dir]} ${e.source} ${e.text}`).join("\n"),
            )
          }
          disabled={b.log.length === 0}
        >
          Copy log
        </button>
      </div>

      <div className="section-head">
        <span className="label">Explore</span>
        <span className="label label--soft">Every characteristic</span>
      </div>
      <button
        className="pill pill--block"
        disabled={!connected}
        onClick={() => run(async () => setChars(await b.blender!.listCharacteristics()))}
      >
        List services
      </button>
      {chars && (
        <div className="chars">
          {chars.map((c) => (
            <div key={c.service + c.uuid}>
              <code>{c.uuid}</code>
              <span className="label">{c.props.join(" ")}</span>
              <code className="label--soft" style={{ color: "var(--ink-soft)" }}>
                in {c.service}
              </code>
            </div>
          ))}
        </div>
      )}

      {chars && (
        <section className="block block--flame stack">
          <Spec label="Raw write">Experimental</Spec>
          <p className="body">
            Sends bytes straight to the base. Unknown commands could do anything the motor can — keep the cup off
            while you experiment.
          </p>
          <select className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Pick a characteristic</option>
            {chars.map((c) => (
              <option key={c.service + c.uuid} value={`${c.service}|${c.uuid}`}>
                {c.uuid.slice(0, 8)} · {c.props.join(" ")}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder="hex, e.g. b4 a0"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
          />
          <div className="row">
            <button
              className="pill pill--fixed"
              disabled={!pick?.props.includes("read")}
              onClick={() => run(() => b.blender!.readRaw(pick!.service, pick!.uuid))}
            >
              Read
            </button>
            <button
              className="pill pill--fixed pill--on"
              disabled={!pick || !/write/i.test(pick.props.join()) || !fromHex(hex) || b.cup === "running"}
              onClick={() => run(() => b.blender!.writeRaw(pick!.service, pick!.uuid, fromHex(hex)!))}
            >
              Write
            </button>
          </div>
          {msg && <p className="label">{msg}</p>}
        </section>
      )}

      <div className="section-head">
        <span className="label">What's known</span>
      </div>
      <div className="stack body" style={{ fontSize: "0.9375rem" }}>
        <p>
          The base starts blending on its own when the cup is locked, running whatever program it was last sent.
          It stops when the program ends or the cup is twisted off. No remote start, stop or power command has
          been found yet — if one exists, it'll turn up in the list above.
        </p>
        <p>
          Protocol from{" "}
          <a href="https://github.com/nightlark/nutribullet" target="_blank" rel="noreferrer">
            nightlark/nutribullet
          </a>
          . Unofficial; not made or endorsed by NutriBullet.
        </p>
      </div>
    </div>
  );
}
