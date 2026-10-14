import { useEffect } from "react";
import { BlendTab } from "./components/BlendTab";
import { DeviceTab } from "./components/DeviceTab";
import { RecipesTab } from "./components/RecipesTab";
import type { Unit } from "./components/ui";
import { useStored } from "./lib/store";
import { useBalance } from "./lib/useBalance";

type Tab = "blend" | "recipes" | "device";
const TABS: { id: Tab; label: string }[] = [
  { id: "blend", label: "Blend" },
  { id: "recipes", label: "Recipes" },
  { id: "device", label: "Device" },
];

export function App() {
  const b = useBalance();
  const [tab, setTab] = useStored<Tab>("balance.tab", "blend");
  const [unit, setUnit] = useStored<Unit>("balance.unit", "g");
  const [theme, setTheme] = useStored<"dark" | "light">("theme", "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#16161a" : "#e8e7e3");
  }, [theme]);

  useEffect(() => window.scrollTo(0, 0), [tab]);

  const led =
    b.link === "connected" ? "led--on" : b.link === "connecting" ? "led--busy" : b.link === "lost" ? "led--lost" : "";

  return (
    <div className="app">
      <header className="top">
        <nav className="top__bar" aria-label="Status">
          <span className="brand">
            <span className="brand__mark" aria-hidden="true" />
            Balance
          </span>
          <button
            className="pill"
            onClick={b.link === "connected" ? () => setTab("device") : b.connect}
            title={b.link === "connected" ? "Connected" : "Connect"}
          >
            <span className={`led ${led}`} aria-hidden="true" />
            {b.link === "connected" ? (b.blender?.demo ? "Demo" : "Linked") : b.link === "connecting" ? "…" : "Connect"}
          </button>
          <button
            className="pill"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="3.2" />
                <path d="M8 .8v2.2M8 13v2.2M.8 8h2.2M13 8h2.2M2.9 2.9l1.6 1.6M11.5 11.5l1.6 1.6M13.1 2.9l-1.6 1.6M4.5 11.5l-1.6 1.6" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M13.5 10.2A5.8 5.8 0 0 1 5.8 2.5a5.8 5.8 0 1 0 7.7 7.7Z" />
              </svg>
            )}
          </button>
        </nav>
      </header>

      <main className="shell">
        {tab === "blend" && <BlendTab b={b} unit={unit} setUnit={setUnit} />}
        {tab === "recipes" && <RecipesTab b={b} unit={unit} onBlend={() => setTab("blend")} />}
        {tab === "device" && <DeviceTab b={b} />}
        <p className="foot">
          Unofficial controller for the NutriBullet Balance · by{" "}
          <a href="https://jonothan.dev">Jonothan Hunt</a>
        </p>
      </main>

      <nav className="tabs" aria-label="Sections">
        <div className="tabs__bar">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`pill${tab === t.id ? " pill--on" : ""}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
