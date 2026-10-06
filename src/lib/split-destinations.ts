/**
 * How the homepage lays out its destination tiles: the first two get the wide
 * row, the next few fill the rows below, and anything past `visible` waits
 * behind "Show all". Order is preserved; busiest countries come first.
 */
export function splitDestinations<T>(items: T[], visible = 8) {
  const wide = items.slice(0, 2);
  const shown = items.slice(2, Math.max(2, visible));
  const hidden = items.slice(Math.max(2, visible));
  return { wide, shown, hidden, hasMore: hidden.length > 0 };
}
