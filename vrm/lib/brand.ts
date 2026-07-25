/**
 * Brand colour helpers.
 *
 * The design was drawn around one specific green (#a6df10). Every client has their
 * own colour, so nothing may be hardcoded -- but a colour alone is not a palette.
 * The design needs a lighter tint, a darker shade, and a text colour that stays
 * readable on top. These derive all of that from the single hex the tenant picks.
 */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Black or white text, whichever stays readable on the brand colour.
 *
 * A bright lime needs near-black text; a navy needs white. Picking one and hoping
 * gives you unreadable buttons for half your clients, which is exactly the sort of
 * thing nobody notices until a customer can't find the record button.
 *
 * Relative luminance per WCAG, then the usual 0.5 threshold.
 */
export function readableTextOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex);

  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  const luminance =
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  // Dark ink rather than pure black -- softer, and it matches the design.
  return luminance > 0.5 ? "#1c2110" : "#ffffff";
}

/** `rgba()` of the brand colour, for glows and rings. */
export function brandAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Every derived value the collection page needs, as CSS custom properties. */
export function brandVars(hex: string): React.CSSProperties {
  return {
    "--brand": hex,
    "--brand-ink": readableTextOn(hex),
    // color-mix keeps the derivation in CSS, so the browser handles the colour
    // space rather than us reimplementing it.
    "--brand-light": `color-mix(in srgb, ${hex} 78%, white)`,
    "--brand-dark": `color-mix(in srgb, ${hex} 88%, black)`,
    "--brand-glow-strong": brandAlpha(hex, 0.5),
    "--brand-glow-soft": brandAlpha(hex, 0.16),
    "--brand-shadow": brandAlpha(hex, 0.55),
  } as React.CSSProperties;
}
