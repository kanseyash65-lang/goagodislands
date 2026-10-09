import { CHRONICLE_MAX_LINES } from '../../core/config/ui.config';
import type { IEventBus } from '../../core/events/event-bus';
import { formatClock } from '../../core/time/clock';
import { el, type IPanel } from '../dom';

const BIG_EVENT = 7;

/** Right-hand log of what reality did ("The sun is now green."). */
export class ChroniclePanel implements IPanel {
  private readonly root = el('div', 'chronicle');
  private readonly list = el('ol', 'chronicle-list');

  constructor(bus: IEventBus) {
    bus.on('ChronicleEntryAdded', ({ text, magnitude, minutes }) => this.add(text, magnitude, minutes));
    bus.on('UiAction', ({ action }) => {
      if (action === 'chronicle') this.root.classList.toggle('open');
    });
  }

  mount(root: HTMLElement): void {
    this.root.append(el('div', 'panel-title', 'CHRONICLE'), this.list);
    this.list.appendChild(el('li', 'chronicle-empty', 'Nothing has happened yet. Susegad.'));
    root.appendChild(this.root);
  }

  private add(text: string, magnitude: number, minutes: number): void {
    this.list.querySelector('.chronicle-empty')?.remove();
    const li = el('li', magnitude > BIG_EVENT ? 'big' : '');
    li.append(el('span', 'when', formatClock(minutes)), el('span', 'what', text));
    this.list.insertBefore(li, this.list.firstChild);
    while (this.list.children.length > CHRONICLE_MAX_LINES) this.list.lastElementChild?.remove();
  }
}
