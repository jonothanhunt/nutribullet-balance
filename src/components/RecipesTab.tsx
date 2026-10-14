import { useEffect, useMemo, useRef, useState } from "react";
import { DemoBlender } from "../ble/device";
import { FOODS, RECIPES, food, totals, type Item, type Recipe } from "../data/food";
import { PROGRAMS } from "../data/programs";
import { useStored } from "../lib/store";
import type { Balance } from "../lib/useBalance";
import { Meter, Sheet, Spec, fmtWeight, type Unit } from "./ui";

const SIZES = [
  { id: "s", label: "Small", k: 0.75 },
  { id: "m", label: "Regular", k: 1 },
  { id: "l", label: "Large", k: 1.25 },
] as const;

const name = (id: string) => food(id)?.name ?? id;

export function RecipesTab({
  b,
  unit,
  onBlend,
}: {
  b: Balance;
  unit: Unit;
  onBlend: () => void;
}) {
  const [mine, setMine] = useStored<Recipe[]>("balance.recipes", []);
  const [open, setOpen] = useState<Recipe | null>(null);

  if (open) {
    return (
      <Session
        key={open.id}
        b={b}
        unit={unit}
        recipe={open}
        onExit={() => setOpen(null)}
        onSave={(r) => setMine([...mine.filter((m) => m.id !== r.id), r])}
        onDelete={open.mine ? () => (setMine(mine.filter((m) => m.id !== open.id)), setOpen(null)) : undefined}
        onBlend={(programId) => {
          b.setProgramId(programId);
          setOpen(null);
          onBlend();
        }}
      />
    );
  }

  const blank: Recipe = {
    id: `mine-${Date.now()}`,
    name: "Freestyle",
    ink: "sun",
    program: "standard",
    items: [],
    mine: true,
  };

  return (
    <div className="stack">
      <button className="pill pill--ink pill--block" onClick={() => setOpen(blank)}>
        + Freestyle
      </button>

      {mine.length > 0 && (
        <>
          <div className="section-head">
            <span className="label">Yours</span>
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
            {mine.map((r) => (
              <RecipeCard key={r.id} r={r} onOpen={() => setOpen(r)} />
            ))}
          </div>
        </>
      )}

      <div className="section-head">
        <span className="label">Recipes</span>
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        {RECIPES.map((r) => (
          <RecipeCard key={r.id} r={r} onOpen={() => setOpen(r)} />
        ))}
      </div>
    </div>
  );
}

function RecipeCard({ r, onOpen }: { r: Recipe; onOpen: () => void }) {
  const t = totals(r.items);
  return (
    <button className={`block block--${r.ink} marks recipe`} onClick={onOpen}>
      <h3>{r.name}</h3>
      <span className="label" style={{ alignSelf: "center" }}>
        {Math.round(t.kcal)} kcal
      </span>
      <span className="label label--soft" style={{ gridColumn: "1 / -1" }}>
        {r.items.map((i) => name(i.food)).join(" · ")}
      </span>
      <div className="recipe__bar" aria-hidden="true">
        {r.items.map((i, k) => (
          <span key={k} style={{ flexGrow: i.grams, flexBasis: 0 }} />
        ))}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------
   A weighing session.

   Each ingredient is weighed from a baseline: whatever the scale read
   when it became the current item. So the cup, and everything already
   in it, never counts — no tare button-pressing between items.
   ------------------------------------------------------------------ */

interface Line {
  food: string;
  target: number | null;
  actual: number | null;
}

/** Within this many grams (or 3%) of the target counts as there. */
const NEAR_G = 4;
const SETTLE_MS = 1200;

function Session({
  b,
  unit,
  recipe,
  onExit,
  onSave,
  onDelete,
  onBlend,
}: {
  b: Balance;
  unit: Unit;
  recipe: Recipe;
  onExit: () => void;
  onSave: (r: Recipe) => void;
  onDelete?: () => void;
  onBlend: (programId: string) => void;
}) {
  const [size, setSize] = useState<(typeof SIZES)[number]["id"]>("m");
  const k = SIZES.find((s) => s.id === size)!.k;
  const [lines, setLines] = useState<Line[]>(() =>
    recipe.items.map((i) => ({ food: i.food, target: i.grams, actual: null })),
  );
  const [at, setAt] = useState(0);
  const [base, setBase] = useState<number | null>(null);
  const [auto, setAuto] = useStored("balance.autoNext", true);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState(recipe.mine ? recipe.name : "");
  const [started, setStarted] = useState(false);

  const live = b.link === "connected" && b.grams != null;
  const finished = at >= lines.length;
  const cur = lines[at];
  const target = cur?.target != null ? Math.round(cur.target * k) : null;
  const added = live && base != null ? b.grams! - base : 0;

  // Start each item from wherever the scale is now.
  useEffect(() => {
    if (live && started) setBase(b.grams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, live, started]);

  // Lifting the cup off, or taking something back out, would leave the
  // count negative for the rest of the item. Settle below the baseline and
  // the baseline follows.
  useEffect(() => {
    if (live && started && b.stable && added < -NEAR_G) setBase(b.grams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.stable, added < -NEAR_G]);

  const commit = (actual: number | null) => {
    setLines((ls) => ls.map((l, i) => (i === at ? { ...l, actual } : l)));
    setAt((a) => a + 1);
  };

  const next = () => commit(live ? Math.max(0, Math.round(added)) : target);

  // Auto-advance once the reading has sat on target for a moment.
  const near = target != null && live && Math.abs(added - target) <= Math.max(NEAR_G, target * 0.03);
  const nearSince = useRef<number | null>(null);
  useEffect(() => {
    if (!auto || !near || !b.stable || finished) {
      nearSince.current = null;
      return;
    }
    nearSince.current ??= Date.now();
    const id = setTimeout(next, Math.max(0, SETTLE_MS - (Date.now() - nearSince.current)));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, near, b.stable, finished, at]);

  const done = lines.filter((l) => l.actual != null);
  const t = useMemo(
    () => totals(done.map((l) => ({ food: l.food, grams: l.actual! }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(done)],
  );
  const planned = totals(lines.map((l) => ({ food: l.food, grams: (l.target ?? 0) * k })));
  const program = PROGRAMS.find((p) => p.id === recipe.program) ?? PROGRAMS[0];
  const over = target != null && added > target + Math.max(NEAR_G, target * 0.03);
  const w = fmtWeight(added, unit);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="pill" style={{ flex: "none" }} onClick={onExit}>
          ← All
        </button>
        <div className="row" style={{ flex: "none" }}>
          {SIZES.map((s) => (
            <button
              key={s.id}
              className={`pill${size === s.id ? " pill--on" : ""}`}
              onClick={() => setSize(s.id)}
              disabled={at > 0 || recipe.items.length === 0}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <section className={`block block--${recipe.ink} marks`}>
        <Spec label={recipe.name}>{Math.round(planned.kcal)} kcal</Spec>

        {live && !started && !finished && (
          <div style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 14, fontSize: "1.375rem" }}>Empty cup on base</h3>
            <div className="row">
              <button className="pill pill--fixed pill--on" onClick={() => setStarted(true)}>
                Start →
              </button>
            </div>
          </div>
        )}

        {(!live || started) && !finished && cur && (
          <div style={{ marginTop: 18 }}>
            <span className="label">
              {at + 1}/{lines.length}
            </span>
            <div className="weigh__now">
              <h3 style={{ fontSize: "1.375rem" }}>{name(cur.food)}</h3>
              {target != null && (
                <span className="label weigh__target">
                  {over ? <span className="weigh__over">Over</span> : `${target} g`}
                </span>
              )}
            </div>
            {live ? (
              <div className="weigh__g" aria-live="polite">
                {w.n}
                <span style={{ fontSize: "0.4em", marginLeft: 6 }}>{w.u}</span>
              </div>
            ) : (
              null
            )}
            {target != null && (
              <div style={{ marginTop: 12 }}>
                <Meter value={live ? added / target : 0} tall />
              </div>
            )}
            {b.blender instanceof DemoBlender && (
              <div className="row" style={{ marginTop: 14 }}>
                {[10, 50, 100].map((g) => (
                  <button key={g} className="pill pill--fixed" onClick={() => (b.blender as DemoBlender).pour(g)}>
                    Demo +{g} g
                  </button>
                ))}
              </div>
            )}
            <div className="row" style={{ marginTop: 1 }}>
              <button className="pill pill--fixed pill--on" onClick={next}>
                {near ? "Got it →" : "Next →"}
              </button>
              <button className="pill pill--fixed" onClick={() => commit(null)}>
                Skip
              </button>
              {live && (
                <button className="pill pill--fixed" onClick={() => setBase(b.grams)} title="Zero this item">
                  Zero
                </button>
              )}
              <button
                className={`pill pill--fixed${auto ? " pill--on" : ""}`}
                onClick={() => setAuto(!auto)}
                aria-pressed={auto}
                title="Move on by itself once the target has settled"
              >
                {auto ? "Auto ✓" : "Auto"}
              </button>
            </div>
          </div>
        )}

        {finished && (
          <div style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 12, fontSize: "1.375rem" }}>
              {lines.length ? `${Math.round(t.grams)} g` : "Empty"}
            </h3>
            {lines.length > 0 && (
              <div className="row">
                <button className="pill pill--fixed pill--on" onClick={() => onBlend(program.id)}>
                  Blend · {program.name}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <ul className="list">
        {lines.map((l, i) => {
          const state = l.actual != null ? "done" : i === at && (!live || started) ? "now" : "";
          const tg = l.target != null ? Math.round(l.target * k) : null;
          return (
            <li key={i} className={`item${state ? ` item--${state}` : ""}`}>
              <span className="item__tick">{l.actual != null ? "✓" : ""}</span>
              <span className="item__name">{name(l.food)}</span>
              <span className="item__g">
                {l.actual != null ? `${l.actual} g` : tg != null ? `${tg} g` : "—"}
                {l.actual != null && tg != null && (
                  <span className="item__x"> / {tg}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <button className="pill pill--block" onClick={() => setAdding(true)}>
        + Add ingredient
      </button>

      <div className="section-head">
        <span className="label">Nutrition</span>
      </div>
      <div className="nutri">
        <div>
          <span className="label label--soft">Energy</span>
          <b>{Math.round(t.kcal)}</b>
          <span className="label label--soft">kcal</span>
        </div>
        <div>
          <span className="label label--soft">Protein</span>
          <b>{t.protein.toFixed(0)}</b>
          <span className="label label--soft">g</span>
        </div>
        <div>
          <span className="label label--soft">Carbs</span>
          <b>{t.carbs.toFixed(0)}</b>
          <span className="label label--soft">g</span>
        </div>
        <div>
          <span className="label label--soft">Sugar</span>
          <b>{t.sugar.toFixed(0)}</b>
          <span className="label label--soft">g</span>
        </div>
        <div>
          <span className="label label--soft">Fibre</span>
          <b>{t.fibre.toFixed(0)}</b>
          <span className="label label--soft">g</span>
        </div>
        <div>
          <span className="label label--soft">Fat</span>
          <b>{t.fat.toFixed(0)}</b>
          <span className="label label--soft">g</span>
        </div>
      </div>

      {finished && done.length > 0 && (
        <section className="block block--paper framed stack">
          <input
            className="field"
            placeholder="Name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="row">
            <button
              className="pill pill--ink"
              disabled={!title.trim()}
              onClick={() => {
                const items: Item[] = done.map((l) => ({ food: l.food, grams: l.actual! }));
                onSave({
                  ...recipe,
                  id: recipe.mine ? recipe.id : `mine-${Date.now()}`,
                  name: title.trim(),
                  items,
                  mine: true,
                });
                setSaved(true);
              }}
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
            {onDelete && (
              <button className="pill" onClick={onDelete}>
                Delete
              </button>
            )}
          </div>
        </section>
      )}

      {adding && (
        <Sheet title="Add" onClose={() => setAdding(false)}>
          <div className="picker">
            {FOODS.map((x) => (
              <button
                key={x.id}
                className="pill"
                onClick={() => {
                  setLines((ls) => {
                    const copy = [...ls];
                    copy.splice(Math.min(at + (finished ? 0 : 1), copy.length), 0, {
                      food: x.id,
                      target: null,
                      actual: null,
                    });
                    return copy;
                  });
                  setAdding(false);
                }}
              >
                {x.name}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
