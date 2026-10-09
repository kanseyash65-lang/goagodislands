import type { IEventBus } from '../../core/events/event-bus';
import { createRng } from '../../core/rng/mulberry32';
import { isAvailable } from '../../gameplay/campaign/campaign';
import { formatCost } from '../../gameplay/economy/economy';
import { MISSIONS, nextMission, type MissionDef } from '../../gameplay/missions/mission-defs';
import type { GameState } from '../../gameplay/state/game-state';
import { clear, el, type IPanel } from '../dom';
import { IslandMinimap } from './island-minimap';

const HOME = { x: 0.14, y: 0.84 };
const ISLAND_R = 0.045;
const W = 1200;
const H = 800;

interface MapIsland {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly mission?: MissionDef;
  readonly seed: number;
}

/**
 * The Goan archipelago: home island, mission islands along a sailing route,
 * fog of war over the undiscovered, a campaign list, a mini-map of your own
 * island and briefing cards with a Defend button.
 */
export class ArchipelagoMap implements IPanel {
  private readonly root = el('div', 'map-screen');
  private readonly canvas = el('canvas', 'map-canvas');
  private readonly card = el('div', 'panel map-card');
  private readonly list = el('div', 'panel map-list');
  private readonly mini = el('div', 'panel map-mini');
  private readonly minimap = new IslandMinimap();
  private readonly miniInfo = el('div', 'map-mini-info');
  private open = false;
  private t = 0;
  private selected: string | null = null;
  /** Fit-to-screen transform shared by drawing and click mapping. */
  private scale = 1;
  private ox = 0;
  private oy = 0;

  constructor(private readonly bus: IEventBus, private readonly state: GameState) {
    bus.on('UiAction', ({ action }) => {
      if (action === 'map' || action === 'missions') this.toggle(true);
      if (action === 'close-panels' || action === 'home' || action === 'start-mission') this.toggle(false);
    });
  }

  mount(root: HTMLElement): void {
    const close = el('button', 'close', '✕');
    close.type = 'button';
    close.addEventListener('click', () => this.toggle(false));
    const title = el('div', 'map-title', '🧭 THE GOAN ARCHIPELAGO');
    this.card.hidden = true;
    this.mini.append(el('h2', '', '🏝️ Your Island'), this.minimap.canvas, this.miniInfo);
    this.root.append(this.canvas, title, close, this.list, this.mini, this.card);
    this.root.hidden = true;
    this.canvas.addEventListener('click', (e) => this.onClick(e));
    root.appendChild(this.root);
    const loop = (): void => {
      if (this.open) {
        this.t += 1 / 60;
        this.draw();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  toggle(show: boolean): void {
    this.open = show;
    this.root.hidden = !show;
    if (!show) {
      this.card.hidden = true;
      return;
    }
    this.renderList();
    this.renderMini();
    // Open on the next mission so it is always obvious where to go.
    const next = nextMission(this.state.campaign.completed) ?? MISSIONS[0];
    const isl = next ? this.islands().find((i) => i.id === next.id) : undefined;
    if (isl) {
      this.selected = isl.id;
      this.showCard(isl);
    }
  }

  /** Every mission in order with its status; tap one to read its briefing. */
  private renderList(): void {
    clear(this.list);
    this.list.appendChild(el('h2', '', '🛡️ Campaign'));
    const rows = el('div', 'map-list-rows');
    for (const m of MISSIONS) {
      const done = this.state.campaign.completed.includes(m.id);
      const avail = isAvailable(this.state, m);
      const row = el('button', `map-row${done ? ' done' : avail ? ' next' : ' locked'}${this.selected === m.id ? ' selected' : ''}`);
      row.type = 'button';
      row.append(el('span', 'map-row-num', String(m.order)), el('span', 'map-row-name', m.name), el('span', 'map-row-state', done ? '✔' : avail ? 'DEFEND' : '🔒'));
      row.addEventListener('click', () => {
        const isl = this.islands().find((i) => i.id === m.id);
        if (!isl) return;
        this.selected = m.id;
        this.showCard(isl);
        this.renderList();
      });
      rows.appendChild(row);
    }
    this.list.appendChild(rows);
  }

  private renderMini(): void {
    const base = this.state.base.buildings;
    this.minimap.draw(base);
    const done = this.state.campaign.completed.length;
    this.miniInfo.textContent = `${base.length} buildings · ${done}/${MISSIONS.length} villages saved`;
  }

  isOpen(): boolean {
    return this.open;
  }

  private islands(): MapIsland[] {
    const list: MapIsland[] = [{ id: 'home', x: HOME.x, y: HOME.y, name: this.state.profile.name === 'YOU' ? 'Your Island' : `${this.state.profile.name}'s Island`, seed: 1 }];
    for (const m of MISSIONS) list.push({ id: m.id, x: m.mapX, y: m.mapY, name: m.name, mission: m, seed: m.island.style.seed });
    for (const c of this.state.campaign.customIslands) list.push({ id: c.id, x: c.x, y: c.y, name: c.name, seed: c.seed });
    return list;
  }

  private discovered(id: string): boolean {
    if (id === 'home' || id.startsWith('custom')) return true;
    const radar = this.state.base.levelOf('radar');
    const m = MISSIONS.find((x) => x.id === id);
    return this.state.campaign.discovered.includes(id) || (m !== undefined && m.order <= 1 + radar);
  }

  private draw(): void {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, this.canvas.clientWidth);
    const ch = Math.max(1, this.canvas.clientHeight);
    if (this.canvas.width !== Math.round(cw * dpr) || this.canvas.height !== Math.round(ch * dpr)) {
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
    }
    this.scale = Math.min(cw / W, ch / H);
    this.ox = (cw - W * this.scale) / 2;
    this.oy = (ch - H * this.scale) / 2;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1478b8';
    g.fillRect(0, 0, cw, ch);
    g.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, dpr * this.ox, dpr * this.oy);
    const sea = g.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#1478b8');
    sea.addColorStop(1, '#2aa8d8');
    g.fillStyle = sea;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 40; i++) {
      const y = (i * 37 + this.t * 8) % H;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(W * 0.3, y + 10, W * 0.6, y - 10, W, y);
      g.stroke();
    }
    const list = this.islands();
    this.drawRoute(g, list);
    for (const isl of list) this.drawIsland(g, isl);
    this.drawCompass(g);
  }

  private drawRoute(g: CanvasRenderingContext2D, list: MapIsland[]): void {
    g.setLineDash([10, 10]);
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(255, 240, 200, 0.7)';
    g.beginPath();
    g.moveTo(HOME.x * W, HOME.y * H);
    for (const isl of list) if (isl.mission) g.lineTo(isl.x * W, isl.y * H);
    g.stroke();
    g.setLineDash([]);
  }

  private drawIsland(g: CanvasRenderingContext2D, isl: MapIsland): void {
    const cx = isl.x * W;
    const cy = isl.y * H;
    const r = ISLAND_R * W * (isl.mission ? 0.8 + isl.mission.island.style.size * 0.3 : 1.1);
    const known = this.discovered(isl.id);
    const rng = createRng(isl.seed);
    const blob = (rad: number, fill: string): void => {
      g.fillStyle = fill;
      g.beginPath();
      for (let a = 0; a <= 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const rr = rad * (0.82 + rng.next() * 0.3);
        g.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.75);
      }
      g.fill();
    };
    blob(r * 1.35, 'rgba(120, 230, 220, 0.55)');
    blob(r * 1.05, '#f2dca0');
    blob(r * 0.8, '#5fae3e');
    if (!known) {
      for (let k = 0; k < 5; k++) {
        g.fillStyle = 'rgba(235, 242, 250, 0.92)';
        g.beginPath();
        g.arc(cx + Math.sin(this.t * 0.5 + k) * 8 + (k - 2) * r * 0.5, cy + Math.cos(this.t * 0.4 + k) * 5, r * 0.75, 0, Math.PI * 2);
        g.fill();
      }
      return;
    }
    const m = isl.mission;
    const done = m ? this.state.campaign.completed.includes(m.id) : false;
    const avail = m ? isAvailable(this.state, m) : true;
    const icon = !m ? '🏝️' : done ? '✅' : avail ? '🛡️' : '🔒';
    g.font = `${Math.round(r * 0.9)}px serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(icon, cx, cy - r * 0.15 + (avail && !done && m ? Math.sin(this.t * 3) * 3 : 0));
    g.font = '900 17px "Arial Black", sans-serif';
    g.lineWidth = 5;
    g.strokeStyle = '#0b1d33';
    g.strokeText(isl.name, cx, cy + r * 1.2);
    g.fillStyle = this.selected === isl.id ? '#ffd23f' : '#fff';
    g.fillText(isl.name, cx, cy + r * 1.2);
    if (m) {
      g.font = '14px serif';
      g.fillText('★'.repeat(m.difficulty), cx, cy + r * 1.2 + 18);
    }
  }

  private drawCompass(g: CanvasRenderingContext2D): void {
    g.save();
    g.translate(W - 80, H - 80);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.moveTo(0, -40);
    g.lineTo(10, 0);
    g.lineTo(0, 40);
    g.lineTo(-10, 0);
    g.fill();
    g.font = '900 16px sans-serif';
    g.textAlign = 'center';
    g.fillText('N', 0, -48);
    g.restore();
  }

  private onClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.ox) / this.scale;
    const y = (e.clientY - rect.top - this.oy) / this.scale;
    const hit = this.islands().find((i) => Math.hypot(i.x * W - x, (i.y * H - y) / 0.75) < ISLAND_R * W * 1.4);
    if (!hit) {
      this.card.hidden = true;
      this.selected = null;
      return;
    }
    this.selected = hit.id;
    this.showCard(hit);
    this.renderList();
  }

  private showCard(isl: MapIsland): void {
    clear(this.card);
    const m = isl.mission;
    const known = this.discovered(isl.id);
    this.card.append(el('h2', '', known ? isl.name : 'Uncharted island'));
    const body = el('div', 'map-card-body');
    const act = (label: string, cls: string, fn: () => void): void => {
      const b = el('button', `btn ${cls}`, label);
      b.type = 'button';
      b.addEventListener('click', fn);
      body.appendChild(b);
    };
    if (!m) {
      body.append(el('p', '', 'Your Goan village. Build, train your villagers and get ready to defend the archipelago.'));
      act('Sail Home', 'primary', () => this.bus.emit('UiAction', { action: 'home' }));
    } else if (!known) {
      body.append(el('p', '', 'Hidden under fog. Win the previous mission (or upgrade your Radar) to chart it.'));
    } else {
      const avail = isAvailable(this.state, m);
      const done = this.state.campaign.completed.includes(m.id);
      body.append(el('p', 'brief', m.brief));
      const ul = el('ul', 'obj');
      for (const o of m.objectives) ul.appendChild(el('li', '', o.label));
      body.append(el('div', 'meta', `${'★'.repeat(m.difficulty)} · Raider level ${m.enemyLevel} · ${m.waves?.length ?? 0} waves · Defend with god powers`), ul);
      body.append(el('div', 'meta', `Reward: ${formatCost(m.reward)} · ${m.reward.gems ?? 0} gems${done ? ' (replay: 30%)' : ''}`));
      if (m.unlocks.length > 0 && !done) body.append(el('div', 'meta', `Unlocks: ${m.unlocks.join(', ')}`));
      if (!avail) body.append(el('p', 'warn', 'Finish the previous mission first.'));
      else {
        act(done ? '🛡️ Defend again' : '🛡️ Defend!', 'red', () => this.bus.emit('UiAction', { action: 'start-mission', arg: m.id }));
      }
    }
    this.card.appendChild(body);
    this.card.hidden = false;
  }
}
