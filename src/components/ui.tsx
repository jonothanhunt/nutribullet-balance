import { useEffect, type ReactNode } from "react";
import type { Step } from "../ble/protocol";
import { MAX_SPEED } from "../ble/protocol";

export function Spec({ label, children }: { label: ReactNode; children?: ReactNode }) {
  return (
    <div className="spec">
      <span>{label}</span>
      <span className="spec__rule" />
      <span className="spec__val">{children}</span>
    </div>
  );
}

export function Meter({ value, tall }: { value: number; tall?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={`meter${tall ? " meter--tall" : ""}`}
      style={{ "--meter": v } as React.CSSProperties}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    />
  );
}

/** A program drawn as columns: width is time, height is speed. */
export function Timeline({
  steps,
  progress,
  big,
}: {
  steps: Step[];
  /** 0–1 through the program, or undefined when not running. */
  progress?: number;
  big?: boolean;
}) {
  const total = steps.reduce((t, s) => t + s.q, 0) || 1;
  return (
    <div className={`timeline${big ? " timeline--big" : ""}`} aria-hidden="true">
      {steps.map((s, i) => (
        <div
          key={i}
          className={`timeline__step${s.speed === 0 ? " timeline__step--rest" : ""}`}
          style={{ flexGrow: s.q, flexBasis: 0, height: `${Math.max(12, (s.speed / MAX_SPEED) * 100)}%` }}
          title={`${s.q / 4}s`}
        />
      ))}
      {progress != null && (
        <>
          <div className="timeline__done" style={{ width: `${progress * 100}%` }} />
          <div className="timeline__head" style={{ left: `calc(${progress * 100}% - 1px)` }} />
        </>
      )}
      <span className="sr-only">{total / 4} seconds</span>
    </div>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__head">
          <h3>{title}</h3>
          <button className="pill" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const fmtSeconds = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
};

export type Unit = "g" | "oz";

export function fmtWeight(g: number, unit: Unit) {
  if (unit === "oz") return { n: (g / 28.3495).toFixed(1), u: "oz" };
  return { n: Math.abs(g) < 0.5 ? "0" : g.toFixed(0), u: "g" };
}
