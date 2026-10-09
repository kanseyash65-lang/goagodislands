import type { IEventBus } from '../core/events/event-bus';
import type { UiActionName } from '../core/events/event-types';
import { clear, el, type IPanel } from './dom';

/**
 * A centered modal card (Army, Build): opens on its HUD button, closes on ✕,
 * on any other HUD action, and re-renders when resources change.
 */
export abstract class Sheet implements IPanel {
  protected readonly body = el('div', 'sheet-body');
  private readonly root = el('div', 'panel sheet');
  private open = false;

  constructor(protected readonly bus: IEventBus, private readonly action: UiActionName, private readonly title: string) {
    bus.on('UiAction', ({ action: a }) => {
      if (a === this.action) this.toggle(!this.open);
      else if (a !== 'mute') this.toggle(false);
    });
    bus.on('ResourcesChanged', () => this.refresh());
    bus.on('SceneChanged', () => this.toggle(false));
  }

  mount(root: HTMLElement): void {
    const close = el('button', 'close', '✕');
    close.type = 'button';
    close.addEventListener('click', () => this.toggle(false));
    this.root.append(el('h2', '', this.title), close, this.body);
    this.root.hidden = true;
    root.appendChild(this.root);
  }

  protected refresh(): void {
    if (!this.open) return;
    clear(this.body);
    this.render();
  }

  protected abstract render(): void;

  protected section(title: string, hint?: string): HTMLElement {
    const sec = el('section', 'sheet-section');
    sec.appendChild(el('h3', '', title));
    if (hint) sec.appendChild(el('p', 'sheet-hint', hint));
    this.body.appendChild(sec);
    return sec;
  }

  protected button(label: string, cls: string, disabled: boolean, fn: () => void): HTMLButtonElement {
    const b = el('button', `btn ${cls}`, label);
    b.type = 'button';
    b.disabled = disabled;
    b.addEventListener('click', () => {
      fn();
      this.refresh();
    });
    return b;
  }

  private toggle(show: boolean): void {
    this.open = show;
    this.root.hidden = !show;
    this.refresh();
  }
}
