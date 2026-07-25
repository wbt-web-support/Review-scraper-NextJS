/**
 * A business name, capitalised for display.
 *
 * Tenant names are typed in by whoever set the client up, and they arrive however
 * that person happened to type them -- "nj designpark", "ACME RENEWABLES". The name
 * is the most prominent thing on the collection page and the review wall, which are
 * pages the client's own customers see, so it has to look deliberate.
 *
 * DISPLAY ONLY. The stored tenants.name is never touched: it is what the operator
 * typed, it is what the delete confirmation makes them re-type, and normalising it
 * in the database would silently rewrite names that were already correct.
 *
 * A word that ALREADY contains a capital is left exactly as it is. That single rule
 * is what makes this safe to apply everywhere -- "iBuildAssets", "WBT", "NJ" and
 * "McDonald" all survive, because the only names it touches are the ones nobody
 * capitalised in the first place.
 */
export function titleCaseName(name: string): string {
  return name
    .split(/(\s+)/) // keep the separators, so spacing survives round-tripping
    .map((part) => (/\s/.test(part) ? part : capitaliseWord(part)))
    .join("");
}

function capitaliseWord(word: string): string {
  // Someone already made a case decision here. Respect it.
  if (/[A-Z]/.test(word)) return word;

  // Capitalise after a hyphen or apostrophe too: "heat-seal" -> "Heat-Seal",
  // "o'brien" -> "O'Brien". Anything else (dots, ampersands, digits) is left alone.
  return word.replace(/(^|[-'’])([a-z])/g, (_, sep: string, letter: string) => sep + letter.toUpperCase());
}
