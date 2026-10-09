/** Read-only camera information for systems that want to act "where the player is looking". */
export interface IViewInfo {
  readonly centerX: number;
  readonly centerY: number;
  readonly viewWidth: number;
  readonly viewHeight: number;
}

export function isInView(v: IViewInfo, x: number, y: number, margin = 0): boolean {
  return (
    Math.abs(x - v.centerX) <= v.viewWidth / 2 + margin &&
    Math.abs(y - v.centerY) <= v.viewHeight / 2 + margin
  );
}
