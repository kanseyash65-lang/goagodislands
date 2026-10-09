import type { CameraRig } from '../../rendering/camera/camera-rig';
import type { GodAvatar } from '../../rendering/god/god-avatar';
import type { GameState } from '../../gameplay/state/game-state';
import { el, type IPanel } from '../dom';

/** Screen band the resource bar and battle timer occupy; the tag is held just below it instead of overlapping. */
const TOP_HUD_PX = 156;
const LABEL_PX = 34;
const EDGE_PX = 70;
/** When pinned to the top band, keep clear of the objectives panel on the left. */
const PINNED_MIN_X = 400;

/**
 * Your name above the floating god, as a crisp HTML tag that follows the
 * avatar and stays readable at every zoom level (a 3D sprite was too faint).
 */
export class GodLabel implements IPanel {
  private readonly root = el('div', 'god-label');
  private readonly name = el('span', 'god-name');
  private readonly head = { x: 0, y: 0, z: 0 };
  private readonly p = { x: 0, y: 0 };
  private shown = '';

  constructor(
    private readonly god: GodAvatar,
    private readonly rig: CameraRig,
    private readonly state: GameState,
    private readonly size: () => { w: number; h: number },
  ) {}

  mount(root: HTMLElement): void {
    this.root.append(this.name, el('span', 'god-title', 'God of Goa'));
    root.appendChild(this.root);
  }

  update(): void {
    if (this.shown !== this.state.profile.name) {
      this.shown = this.state.profile.name;
      this.name.textContent = this.shown;
    }
    this.god.headPosition(this.head);
    const { w, h } = this.size();
    const visible = this.rig.project(this.head.x, this.head.y, this.head.z, w, h, this.p);
    // Pinned inside the screen so your name stays readable even when the god floats above the view.
    // In a mission the tag never sits on the battle HUD: it hides instead of pinning.
    const battle = document.body.dataset['scene'] === 'battle';
    this.root.hidden = !visible || this.p.y > h + 40 || (battle && this.p.y < TOP_HUD_PX + LABEL_PX);
    const minY = TOP_HUD_PX + LABEL_PX;
    const pinned = this.p.y < minY;
    const x = Math.min(w - EDGE_PX, Math.max(pinned ? PINNED_MIN_X : EDGE_PX, this.p.x));
    this.root.style.transform = `translate(${x.toFixed(0)}px, ${Math.max(minY, this.p.y).toFixed(0)}px) translate(-50%, -100%)`;
  }
}
