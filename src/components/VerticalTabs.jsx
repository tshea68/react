import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * VerticalTabs
 * - Vertical tab list on pad+ breakpoints
 * - On smaller screens it becomes a <select> for easy mobile use
 *
 * Props:
 *  - tabs: [{ id: string, label: string, content: ReactNode | () => ReactNode }]
 *  - defaultTabId?: string
 *  - className?: string
 */
export default function VerticalTabs({ tabs = [], defaultTabId, className = "" }) {
  const ids = useMemo(() => tabs.map(t => t.id), [tabs]);
  const [active, setActive] = useState(defaultTabId || ids[0]);
  const btnRefs = useRef({});

  useEffect(() => {
    if (defaultTabId && ids.includes(defaultTabId)) setActive(defaultTabId);
  }, [defaultTabId, ids]);

  const idx = ids.indexOf(active);

  const focusBtn = (id) => {
    const el = btnRefs.current[id];
    if (el) el.focus();
  };

  const onKeyDown = (e) => {
    if (!ids.length) return;
    let next = idx;
    if (e.key === "ArrowUp") next = Math.max(0, idx - 1);
    if (e.key === "ArrowDown") next = Math.min(ids.length - 1, idx + 1);
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = ids.length - 1;
    if (next !== idx) {
      e.preventDefault();
      setActive(ids[next]);
      focusBtn(ids[next]);
    }
  };

  return (
    <section className={`w-full ${className}`}>
      {/* Mobile: dropdown */}
      <div className="pad:hidden mb-3">
        <label className="sr-only" htmlFor="vtabs-select">Select section</label>
        <select
          id="vtabs-select"
          className="w-full rounded border px-3 py-2 text-sm"
          value={active}
          onChange={(e) => setActive(e.target.value)}
        >
          {tabs.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="grid pad:grid-cols-[220px,1fr] gap-4">
        {/* Vertical tab list (pad+) */}
        <nav
          className="hidden pad:block"
          role="tablist"
          aria-orientation="vertical"
        >
          <ul className="space-y-1">
            {tabs.map((t) => {
              const selected = active === t.id;
              return (
                <li key={t.id}>
                  <button
                    ref={(el) => (btnRefs.current[t.id] = el)}
                    role="tab"
                    id={`tab-${t.id}`}
                    aria-selected={selected}
                    aria-controls={`panel-${t.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(t.id)}
                    onKeyDown={onKeyDown}
                    className={[
                      "w-full text-left px-3 py-2 rounded border",
                      "transition-colors focus:outline-none focus:ring-2",
                      selected
                        ? "bg-white text-black border-yellow-400 ring-yellow-400"
                        : "bg-[#0F2F57] text-white/90 border-transparent hover:bg-[#123662]"
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Panels */}
        <div>
          {tabs.map((t) => {
            const selected = active === t.id;
            const content = typeof t.content === "function" ? t.content() : t.content;
            return (
              <section
                key={t.id}
                role="tabpanel"
                id={`panel-${t.id}`}
                aria-labelledby={`tab-${t.id}`}
                hidden={!selected}
                className="min-h-[200px]"
              >
                {selected && content}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
