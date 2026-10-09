import type { IEventBus } from '../../core/events/event-bus';
import { el, type IPanel } from '../dom';

const TOAST_MS = 3800;
const MAX_TOASTS = 3;

/** Friendly, in-universe notices. Never red error states. */
export class ToastLayer implements IPanel {
  private readonly root = el('div', 'toasts');

  constructor(bus: IEventBus) {
    bus.on('ToastRequested', ({ text }) => this.show(text));
  }

  mount(root: HTMLElement): void {
    root.appendChild(this.root);
  }

  show(text: string): void {
    const t = el('div', 'toast', text);
    this.root.appendChild(t);
    while (this.root.children.length > MAX_TOASTS) this.root.firstElementChild?.remove();
    window.setTimeout(() => t.classList.add('out'), TOAST_MS);
    window.setTimeout(() => t.remove(), TOAST_MS + 400);
  }
}
