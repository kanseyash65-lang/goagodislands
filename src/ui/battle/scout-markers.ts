import type { BattleController } from '../../gameplay/battle/battle-controller';
import type { CameraRig } from '../../rendering/camera/camera-rig';
import { el, type IPanel } from '../dom';

const POOL = 12;
const LIFT = 6;

/** Floating "?" marks over suspicious jungle spots during scouting (found ones turn to "!"). */
export class ScoutMarkers implements IPanel {
  private readonly root = el('div', 'scout-markers');
  private readonly nodes: HTMLElement[] = [];
  private readonly p = { x: 0, y: 0 };

  constructor(
    private readonly battle: BattleController,
    private readonly rig: CameraRig,
    private readonly size: () => { w: number; h: number },
    private readonly groundAt: (x: number, y: number) => number,
  ) {}

  mount(root: HTMLElement): void {
    for (let i = 0; i < POOL; i++) {
      const n = el('div', 'scout-mark', '?');
      n.hidden = true;
      this.nodes.push(n);
      this.root.appendChild(n);
    }
    root.appendChild(this.root);
  }

  update(): void {
    const marks = this.battle.active && (this.battle.phase === 'scouting' || this.battle.phase === 'fighting') ? this.battle.scoutMarkers : [];
    const { w, h } = this.size();
    this.nodes.forEach((n, i) => {
      const m = marks[i];
      if (!m) {
        n.hidden = true;
        return;
      }
      const visible = this.rig.project(m.x, this.groundAt(m.x, m.y) + LIFT, m.y, w, h, this.p);
      n.hidden = !visible;
      n.textContent = m.found ? '!' : '?';
      n.classList.toggle('found', m.found);
      n.style.transform = `translate(${this.p.x.toFixed(0)}px, ${this.p.y.toFixed(0)}px) translate(-50%, -50%)`;
    });
  }
}
