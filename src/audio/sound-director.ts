import type { IEventBus } from '../core/events/event-bus';
import type { AudioManager } from './audio-manager';
import { Sfx } from './sfx';

/** Crackles per second per burning building, capped so a big blaze is not a drum roll. */
const CRACKLE_PER_FIRE = 0.35;
const CRACKLE_MAX = 1.2;

/**
 * Event → sound router. Systems never call audio directly; this listens to the
 * same events as the renderer. Everything is a short one-shot: no hissing loops.
 */
export class SoundDirector {
  readonly sfx: Sfx;

  constructor(private readonly audio: AudioManager, bus: IEventBus, private readonly fires: () => number) {
    const s = new Sfx(audio);
    this.sfx = s;
    bus.on('CommandSubmitted', () => s.whoosh());
    bus.on('CommandExecuted', ({ command }) => { if (command.magnitude > 0) s.cast(); });
    bus.on('EntitiesSpawned', ({ count }) => s.pop(count));
    bus.on('ShotFired', ({ kind }) => {
      if (kind === 'bullet' || kind === 'snipe' || kind === 'melee') s.gun(false);
      else if (kind === 'shell' || kind === 'mortar') s.cannon();
      else s.gun(true);
    });
    bus.on('ExplosionHappened', ({ big }) => s.explosion(big));
    bus.on('BuildingDestroyed', () => s.explosion(true));
    bus.on('LightningStruck', () => s.lightning());
    bus.on('ImpactRequested', ({ flash }) => { if (flash > 0.4) s.lightning(); });
    bus.on('WeatherChanged', ({ weather }) => { if (weather === 'rain' || weather === 'storm') s.splashHiss(); });
    bus.on('BattleEnded', ({ victory }) => (victory ? s.victory() : s.defeat()));
    bus.on('UiAction', ({ action }) => {
      if (action === 'mute') {
        const muted = audio.toggleMute();
        bus.emit('ToastRequested', { text: muted ? '🔇 Sound off' : '🔊 Sound on' });
      } else s.click();
    });
    bus.on('ToastRequested', ({ text }) => { if (text.startsWith('⛵') || text.startsWith('Wave')) s.alarm(); });
  }

  /** 10 Hz: an occasional soft crackle while something burns. No continuous noise loops. */
  update(dt: number): void {
    if (!this.audio.ready) return;
    const n = this.fires();
    if (n > 0 && Math.random() < Math.min(CRACKLE_MAX, CRACKLE_PER_FIRE * n) * dt) this.sfx.crackle();
  }
}
