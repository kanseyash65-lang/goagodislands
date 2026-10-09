/** Tiny DOM helpers. All text goes through textContent (never innerHTML with user text). */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function clear(e: HTMLElement): void {
  while (e.firstChild) e.removeChild(e.firstChild);
}

/** A mounted UI panel (07 §10). */
export interface IPanel {
  mount(root: HTMLElement): void;
}
