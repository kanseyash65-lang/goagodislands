import type { IEventBus } from '../../core/events/event-bus';
import { ABILITIES, ABILITY_INFO, type AbilityName } from '../../gameplay/battle/abilities';
import type { BattleController } from '../../gameplay/battle/battle-controller';
import type { GameState } from '../../gameplay/state/game-state';
import { GOD_POWERS } from '../../data/god-powers';
import { clear, el, type IPanel } from '../dom';

const TROOP_ICON: Readonly<Record<string, string>> = { rifleman: '🪖', heavy: '🛡️', rocketeer: '🚀', medic: '⛑️', engineer: '🧨', commander: '👑' };
/** Mission title card timing (ms). */
const INTRO_MS = 3200;
const INTRO_FADE_MS = 600;
const KIT_ICON: Readonly<Record<string, string>> = { mine: '💣', wall: '🧱', 'machine-gun': '🔫', cannon: '💥' };

/** What the next tap on the island does during battle. */
export type Armed = { type: 'ability'; name: AbilityName } | { type: 'kit'; kind: string } | { type: 'squad'; index: number } | null;

/**
 * Battle UI: timer + energy, phase banner, objectives, landing-craft cards,
 * gunboat ability buttons (arm, then tap the island), deploy/retreat/start-waves.
 */
export class BattleHud implements IPanel {
  armed: Armed = null;
  private readonly root = el('div', 'battle-hud');
  private readonly top = el('div', 'bh-top');
  private readonly title = el('span', 'bh-title');
  private readonly powers = el('div', 'bh-powers');
  private readonly retreat = el('button', 'btn red bh-retreat', 'Retreat');
  private readonly pause = el('button', 'btn bh-pause', '⏸');
  private readonly paused = el('div', 'bh-paused');
  private readonly intro = el('div', 'mission-intro');
  private introTimer = 0;
  private readonly timer = el('span', 'bh-timer');
  private readonly energyFill = el('div', 'bh-energy-fill');
  private readonly energyText = el('span', 'bh-energy-text');
  private readonly banner = el('div', 'bh-banner');
  private readonly objectives = el('ol', 'bh-objectives');
  private readonly squads = el('div', 'bh-squads');
  private readonly abilities = el('div', 'bh-abilities');
  private readonly actions = el('div', 'bh-actions');

  constructor(private readonly bus: IEventBus, private readonly battle: BattleController, private readonly state: GameState) {
    bus.on('BattleChanged', () => this.render());
    // Mid-mission, an idea the island did not understand gets a gentle nudge toward the god powers.
    bus.on('CommandExecuted', ({ result }) => {
      if (this.battle.active && result.improvised) this.bus.emit('ToastRequested', { text: '🤔 Not sure what that does here. Try “Make it rain” or “God, do something”.' });
    });
    bus.on('SceneChanged', ({ scene }) => {
      this.armed = null;
      this.render();
      if (scene === 'battle') this.showIntro();
    });
    bus.on('PauseChanged', ({ paused }) => { this.paused.hidden = !paused; });
  }

  mount(root: HTMLElement): void {
    const energy = el('div', 'bh-energy');
    energy.append(el('span', 'bh-energy-icon', '⚡'), this.energyFill, this.energyText);
    this.top.append(this.title, this.timer, energy);
    const bottom = el('div', 'bh-bottom');
    bottom.append(this.squads, this.abilities, this.actions);
    this.retreat.type = 'button';
    this.retreat.addEventListener('click', () => this.bus.emit('UiAction', { action: 'retreat' }));
    this.renderPowers();
    this.pause.type = 'button';
    this.pause.title = 'Pause (or say "pause")';
    this.pause.addEventListener('click', () => this.bus.emit('UiAction', { action: 'pause' }));
    const resume = el('button', 'btn primary', '▶ Resume');
    resume.type = 'button';
    resume.addEventListener('click', () => this.bus.emit('UiAction', { action: 'pause' }));
    this.paused.append(el('div', 'bh-paused-title', '⏸ PAUSED'), el('div', 'bh-paused-hint', 'The raiders are frozen in time.'), resume);
    this.paused.hidden = true;
    this.intro.hidden = true;
    this.root.append(this.top, this.banner, this.objectives, bottom, this.powers, this.retreat, this.pause, this.paused, this.intro);
    root.appendChild(this.root);
    this.render();
  }

  /** Per-frame-ish (4 Hz) numbers. */
  update(): void {
    if (!this.battle.active) return;
    if (this.battle.mission?.mode === 'village' && this.battle.phase === 'fighting') this.banner.textContent = this.villageHint();
    const t = Math.max(0, Math.ceil(this.battle.timeLeft));
    this.timer.textContent = `⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.energyFill.style.width = `${Math.min(100, (this.battle.energy / 30) * 100).toFixed(0)}%`;
    this.energyText.textContent = String(this.battle.energy);
    this.renderObjectives();
  }

  /** Cinematic mission title while the camera flies in from the sea. */
  private showIntro(): void {
    const m = this.battle.mission;
    if (!m) return;
    this.intro.replaceChildren(el('div', 'mi-num', `MISSION ${m.order}`), el('div', 'mi-name', m.name), el('div', 'mi-goal', `Raiders are landing at ${m.place}. Protect the villagers with your voice.`));
    this.intro.hidden = false;
    this.intro.classList.remove('out');
    window.clearTimeout(this.introTimer);
    this.introTimer = window.setTimeout(() => {
      this.intro.classList.add('out');
      this.introTimer = window.setTimeout(() => { this.intro.hidden = true; }, INTRO_FADE_MS);
    }, INTRO_MS);
  }

  private render(): void {
    const b = this.battle;
    this.root.hidden = !b.active;
    if (!b.active) return;
    const village = b.mission?.mode === 'village';
    this.root.classList.toggle('village', village);
    this.title.textContent = b.mission?.name ?? '';
    this.powers.hidden = !village || b.phase === 'victory' || b.phase === 'defeat';
    this.retreat.hidden = !village || b.phase === 'victory' || b.phase === 'defeat';
    this.pause.hidden = this.retreat.hidden;
    this.banner.textContent = this.bannerText();
    this.renderSquads();
    this.renderAbilities();
    this.renderActions();
    this.update();
  }

  private bannerText(): string {
    switch (this.battle.phase) {
      case 'scouting': return this.battle.scoutMarkers.length > 0 ? '🔍 Scout the jungle: tap the ? marks to spot hidden defenses' : '🔍 Scouting. Pick a squad and tap the beach to land, or press Attack.';
      case 'ready': return '⚓ Tap a squad, then tap the beach to land it';
      case 'prep': return '🛠 Prepare the defense: place your kit, position troops on land, then Start Waves';
      case 'fighting': return this.armed ? `🎯 Tap the island to use ${this.armedLabel()}` : '';
      case 'escape': return '🏃 Get any troop back to the beach!';
      default: return '';
    }
  }

  private armedLabel(): string {
    const a = this.armed;
    if (!a) return '';
    if (a.type === 'ability') return ABILITY_INFO[a.name].label;
    if (a.type === 'kit') return a.kind;
    return 'squad';
  }

  private renderObjectives(): void {
    clear(this.objectives);
    for (const o of this.battle.objectives) {
      const li = el('li', o.done ? 'done' : o.failed ? 'failed' : '');
      const count = o.target > 1 ? ` (${Math.min(o.progress, o.target)}/${o.target})` : '';
      li.textContent = `${o.done ? '✔' : o.failed ? '✖' : '◻'} ${o.def.label}${o.def.type === 'protect' ? ` (lost ${o.progress})` : count}`;
      this.objectives.appendChild(li);
    }
  }

  private renderSquads(): void {
    clear(this.squads);
    this.battle.squads.forEach((s, i) => {
      const card = el('button', `bh-card${s.deployed ? ' used' : ''}${this.armed?.type === 'squad' && this.armed.index === i ? ' armed' : ''}`);
      card.type = 'button';
      card.disabled = s.deployed;
      card.append(el('span', 'bh-card-icon', TROOP_ICON[s.kind] ?? '🪖'), el('span', 'bh-card-count', `×${s.count}`), el('span', 'bh-card-name', s.kind));
      card.addEventListener('click', () => this.arm({ type: 'squad', index: i }));
      this.squads.appendChild(card);
    });
    if (this.battle.phase === 'prep') {
      for (const k of this.battle.kit) {
        const card = el('button', `bh-card kit${this.armed?.type === 'kit' && this.armed.kind === k.kind ? ' armed' : ''}`);
        card.type = 'button';
        card.disabled = k.count <= 0;
        card.append(el('span', 'bh-card-icon', KIT_ICON[k.kind] ?? '🧱'), el('span', 'bh-card-count', `×${k.count}`), el('span', 'bh-card-name', k.kind));
        card.addEventListener('click', () => this.arm({ type: 'kit', kind: k.kind }));
        this.squads.appendChild(card);
      }
    }
  }

  private renderAbilities(): void {
    clear(this.abilities);
    if (this.battle.phase === 'prep') return;
    if (this.battle.mission?.mode === 'village') return;
    for (const name of ABILITIES) {
      const info = ABILITY_INFO[name];
      const locked = !this.state.isUnlocked(name);
      const cost = this.battle.abilities.costs[name];
      const btn = el('button', `bh-ability${this.armed?.type === 'ability' && this.armed.name === name ? ' armed' : ''}${locked ? ' locked' : ''}`);
      btn.type = 'button';
      btn.title = locked ? `${info.label}: locked` : info.help;
      btn.disabled = locked || this.battle.energy < cost;
      btn.append(el('span', 'bh-ab-icon', locked ? '🔒' : info.icon), el('span', 'bh-ab-cost', `${cost}⚡`));
      btn.addEventListener('click', () => this.arm({ type: 'ability', name }));
      this.abilities.appendChild(btn);
    }
  }

  /** One tidy grid of god powers, each labelled with the exact words to say. */
  private renderPowers(): void {
    for (const p of GOD_POWERS) {
      const btn = el('button', 'bh-power');
      btn.type = 'button';
      btn.title = p.help;
      btn.dataset['words'] = p.words;
      btn.append(el('span', 'bh-power-icon', p.icon), el('span', 'bh-power-words', p.words), el('span', 'bh-power-label', p.label));
      btn.addEventListener('click', () => this.bus.emit('CommandSubmitted', { raw: p.words, source: 'suggestion' }));
      this.powers.appendChild(btn);
    }
  }

  /** Tells the player which voice power fits the moment. */
  private villageHint(): string {
    const v = this.battle.villageStats();
    if (v.fires > 0) return `🔥 ${v.fires} building${v.fires === 1 ? ' is' : 's are'} on fire! Say: “Make it rain”`;
    if (v.engineers > 0) return `💣 ${v.engineers} engineer${v.engineers === 1 ? ' is' : 's are'} blowing up houses! Say: “God, do something”`;
    if (v.villagers > 0 && v.villagersHurt >= Math.max(2, Math.ceil(v.villagers / 3))) return '💔 Your villagers are hurt! Say: “Increase the HP of villagers”';
    if (v.raiders > v.villagers && v.raiders > 0) return '⚡ The raiders are winning! Say: “God, do something!”';
    if (v.raiders === 0 && v.wave < v.waves) return `⛵ Wave ${v.wave + 1} of ${v.waves} is coming. Get ready!`;
    if (v.gunboat && v.raiders === 0) return '⛵ The raider gunboat is shelling the village. Say: “Strike the enemy boat”';
    return `⚔ Wave ${Math.max(1, v.wave)} of ${v.waves} · ${v.raiders} raider${v.raiders === 1 ? '' : 's'} left · ${v.villagers} villagers fighting`;
  }

  private renderActions(): void {
    clear(this.actions);
    const b = this.battle;
    const add = (label: string, cls: string, fn: () => void): void => {
      const btn = el('button', `btn ${cls}`, label);
      btn.type = 'button';
      btn.addEventListener('click', fn);
      this.actions.appendChild(btn);
    };
    if (b.phase === 'prep') add('Start Waves', 'red', () => b.startWaves());
    if (b.squads.some((s) => !s.deployed) && b.canDeploy()) add(b.phase === 'scouting' ? 'Attack! (land all)' : 'Land all', 'primary', () => b.deployAll());
    if (b.phase !== 'victory' && b.phase !== 'defeat' && b.mission?.mode !== 'village') add('Retreat', 'red', () => this.bus.emit('UiAction', { action: 'retreat' }));
  }

  private arm(a: Armed): void {
    const same = JSON.stringify(a) === JSON.stringify(this.armed);
    this.armed = same ? null : a;
    this.render();
  }

  /** Consumes the armed action after a successful tap (squads/abilities are single-use per tap). */
  disarm(): void {
    this.armed = null;
    this.render();
  }
}
