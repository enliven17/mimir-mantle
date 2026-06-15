"use client";

/**
 * Theme-aware Plasma backdrop. Same rose plasma in both themes, but the
 * gradient floor swaps: light mode ramps blush→rose, dark mode ramps
 * near-black→rose so the page stays dark while the plasma still glows.
 * Reacts live to the theme toggle via a class observer.
 */
import { useEffect, useState } from "react";
import Plasma from "./Plasma";

// Light blush ramp (matches the light pv tokens).
const LIGHT_PAL: [string, string, string, string] = [
  "#FCF8F8",
  "#FBEFEF",
  "#F9DFDF",
  "#F5AFAF",
];

// Near-black warm base → deep maroon → bright rose (matches dark pv tokens).
const DARK_PAL: [string, string, string, string] = [
  "#120C0C",
  "#2A1414",
  "#7A3838",
  "#E87878",
];

export default function PlasmaBackdrop() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return (
    <Plasma
      color="#F5AFAF"
      pal={dark ? DARK_PAL : LIGHT_PAL}
      speed={0.9}
      scale={1}
      opacity={dark ? 0.9 : 0.85}
      mouseInteractive={false}
    />
  );
}
