import { hexToRgb, type Rgb } from '../../types/rgb';
import type { ColorSpecial } from '../types';

/** ≥ 40 named colours + specials (05 §7). */
export interface ColorEntry {
  readonly name: string;
  readonly rgb: Rgb;
  readonly special: ColorSpecial;
}

const HEX: readonly [string, string][] = [
  ['red', '#ff4a3d'], ['orange', '#ff9a2e'], ['yellow', '#ffe14a'], ['green', '#4ee05a'], ['blue', '#3f8cff'],
  ['purple', '#a35cff'], ['pink', '#ff7ac6'], ['white', '#ffffff'], ['black', '#2a2a33'], ['gray', '#9a9aa6'],
  ['brown', '#9a6436'], ['cyan', '#3ff0f0'], ['magenta', '#ff3ff0'], ['violet', '#8f5cff'], ['indigo', '#5a4dff'],
  ['teal', '#2fbfa8'], ['turquoise', '#40e0d0'], ['lime', '#a6ff3f'], ['gold', '#ffd23f'], ['golden', '#ffcc33'],
  ['silver', '#d0d4dc'], ['beige', '#e8d8b0'], ['maroon', '#8a2a3a'], ['navy', '#2a3a8a'], ['olive', '#8a9a3a'],
  ['coral', '#ff7f6a'], ['salmon', '#ff9a85'], ['lavender', '#c8a8ff'], ['mint', '#9affc8'], ['peach', '#ffc29a'],
  ['crimson', '#e0203f'], ['scarlet', '#ff2a1a'], ['amber', '#ffb31a'], ['aqua', '#3fffe0'], ['emerald', '#2ed27a'],
  ['ruby', '#e0115f'], ['sapphire', '#2a5aff'], ['chartreuse', '#c8ff3f'], ['tan', '#d2b48c'], ['ivory', '#fffbe6'],
  ['rose', '#ff6f9a'], ['plum', '#9a4a8a'], ['lilac', '#c8a2e0'], ['bronze', '#c8823a'], ['cream', '#fff3cc'],
  ['grey', '#9a9aa6'], ['sky blue', '#7ec8ff'], ['hot pink', '#ff3fa8'], ['neon green', '#5aff3f'], ['blood red', '#b0101a'],
];

const SPECIALS: readonly [string, ColorSpecial, string][] = [
  ['rainbow', 'rainbow', '#ffffff'], ['rainbow colored', 'rainbow', '#ffffff'], ['multicolored', 'rainbow', '#ffffff'],
  ['disco', 'rainbow', '#ffffff'], ['invisible', 'invisible', '#ffffff'], ['transparent', 'invisible', '#ffffff'],
  ['see through', 'invisible', '#ffffff'], ['glowing', 'glowing', '#fff2b0'], ['glow', 'glowing', '#fff2b0'],
  ['shiny', 'glowing', '#ffffff'], ['sparkly', 'glowing', '#ffe8ff'], ['radioactive', 'glowing', '#9aff3f'],
  ['random', 'random', '#ffffff'], ['random colors', 'random', '#ffffff'], ['colorful', 'random', '#ffffff'],
  ['plaid', 'random', '#ffffff'],
];

export const COLOR_TABLE: readonly [string, ColorEntry][] = [
  ...HEX.map(([n, h]): [string, ColorEntry] => [n, { name: n === 'grey' ? 'gray' : n, rgb: hexToRgb(h), special: 'none' }]),
  ...SPECIALS.map(([n, s, h]): [string, ColorEntry] => [n, { name: n, rgb: hexToRgb(h), special: s }]),
];

/** Colour modifiers: dark/light/neon/pastel adjust the base colour. */
export const COLOR_MODIFIERS: ReadonlyMap<string, (c: Rgb) => Rgb> = new Map([
  ['dark', (c: Rgb) => ({ r: c.r * 0.55, g: c.g * 0.55, b: c.b * 0.55 })],
  ['deep', (c: Rgb) => ({ r: c.r * 0.65, g: c.g * 0.65, b: c.b * 0.65 })],
  ['light', (c: Rgb) => ({ r: c.r + (1 - c.r) * 0.45, g: c.g + (1 - c.g) * 0.45, b: c.b + (1 - c.b) * 0.45 })],
  ['pale', (c: Rgb) => ({ r: c.r + (1 - c.r) * 0.55, g: c.g + (1 - c.g) * 0.55, b: c.b + (1 - c.b) * 0.55 })],
  ['pastel', (c: Rgb) => ({ r: c.r + (1 - c.r) * 0.6, g: c.g + (1 - c.g) * 0.6, b: c.b + (1 - c.b) * 0.6 })],
  ['neon', (c: Rgb) => ({ r: Math.min(1.3, c.r * 1.3), g: Math.min(1.3, c.g * 1.3), b: Math.min(1.3, c.b * 1.3) })],
  ['bright', (c: Rgb) => ({ r: Math.min(1.2, c.r * 1.2), g: Math.min(1.2, c.g * 1.2), b: Math.min(1.2, c.b * 1.2) })],
]);
