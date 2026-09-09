"use client";

/**
 * Light / dark / system. Stamps data-theme on <html>, which the palette's
 * [data-theme] scope reads so an explicit choice wins over the OS setting in
 * both directions.
 *
 * Deliberately stateless. The stored choice is not known during server
 * render, so holding it in React state would either mismatch hydration or
 * require setting state inside an effect. Instead the layout's bootstrap
 * script stamps the attribute before first paint, and this control syncs its
 * own displayed value from the DOM on mount through a ref.
 */

import { useEffect, useRef } from "react";

type Mode = "system" | "light" | "dark";
const KEY = "cc-theme";
const MODES: Mode[] = ["system", "light", "dark"];

function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
}

export default function ThemeToggle() {
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let initial: Mode = "system";
    const stamped = document.documentElement.getAttribute("data-theme");
    if (stamped === "light" || stamped === "dark") {
      initial = stamped;
    } else {
      try {
        const stored = window.localStorage.getItem(KEY);
        if (stored === "light" || stored === "dark") initial = stored;
      } catch {
        /* private mode or blocked storage: system is a fine default */
      }
    }
    el.value = initial;
    apply(initial);
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as Mode;
    apply(next);
    try {
      if (next === "system") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="field">
      <label htmlFor="theme-select">Theme</label>
      <select
        id="theme-select"
        ref={ref}
        defaultValue="system"
        onChange={onChange}
      >
        {MODES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
