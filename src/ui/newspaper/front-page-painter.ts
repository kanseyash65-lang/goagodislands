import { drawPixelText, measurePixelText } from '../../assets/fonts/pixel-font';
import { NEWSPAPER_HEIGHT, NEWSPAPER_WIDTH } from '../../core/config/ui.config';
import type { FrontPage } from '../../systems/newspaper/front-page-generator';

const W = NEWSPAPER_WIDTH;
const H = NEWSPAPER_HEIGHT;
const M = 40; // page margin
const PAPER = '#f3ead2';
const INK = '#2b2420';
const FADED = '#6b5e50';
const SERIF = 'Georgia, "Times New Roman", serif';
const PHOTO_W = 540;
const PHOTO_H = 330;
const MAST_SCALE = 8;
const SEPIA = [1.07, 0.74, 0.43] as const;

/** Paints the whole front page onto a canvas (the same canvas is shown and exported). */
export function paintFrontPage(canvas: HTMLCanvasElement, page: FrontPage, photo: HTMLCanvasElement | undefined): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  paintPaper(ctx);
  let y = paintMasthead(ctx, page);
  y = paintHeadline(ctx, page, y);
  paintPhotoBlock(ctx, page, photo, y);
  paintLeadColumn(ctx, page, y);
  paintBottom(ctx, page, y + PHOTO_H + 70);
  ctx.fillStyle = FADED;
  ctx.font = `italic 18px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText('Goa God Islands · Speak, and Goa listens.', W / 2, H - 24);
  ctx.textAlign = 'left';
}

function paintPaper(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(120, 90, 40, 0.035)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, W - 28, H - 28);
}

function rule(ctx: CanvasRenderingContext2D, y: number, width = 2): void {
  ctx.fillStyle = INK;
  ctx.fillRect(M, y, W - M * 2, width);
}

function paintMasthead(ctx: CanvasRenderingContext2D, page: FrontPage): number {
  const mw = measurePixelText(page.masthead, MAST_SCALE);
  drawPixelText(ctx, page.masthead, (W - mw) / 2, 40, MAST_SCALE, INK);
  rule(ctx, 112, 4);
  ctx.font = `bold 15px ${SERIF}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(page.dateLine, W / 2, 136);
  ctx.textAlign = 'left';
  rule(ctx, 148, 1);
  return 160;
}

function paintHeadline(ctx: CanvasRenderingContext2D, page: FrontPage, top: number): number {
  let size = 60;
  let lines: string[] = [];
  for (; size >= 34; size -= 4) {
    ctx.font = `900 ${size}px ${SERIF}`;
    lines = wrap(ctx, page.headline, W - M * 2);
    if (lines.length <= 3) break;
  }
  ctx.fillStyle = INK;
  let y = top + size;
  for (const l of lines.slice(0, 3)) {
    ctx.fillText(l, M, y);
    y += size * 1.05;
  }
  ctx.font = `italic 26px ${SERIF}`;
  ctx.fillStyle = FADED;
  ctx.fillText(page.subhead, M, y + 6);
  rule(ctx, y + 24, 1);
  return y + 40;
}

function paintPhotoBlock(ctx: CanvasRenderingContext2D, page: FrontPage, photo: HTMLCanvasElement | undefined, top: number): void {
  ctx.fillStyle = '#d8ccb0';
  ctx.fillRect(M, top, PHOTO_W, PHOTO_H);
  if (photo) ctx.drawImage(photo, M, top, PHOTO_W, PHOTO_H);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(M, top, PHOTO_W, PHOTO_H);
  ctx.font = `italic 16px ${SERIF}`;
  ctx.fillStyle = FADED;
  ctx.fillText('ABOVE: The scene, moments later. Photo: a passing pigeon.', M, top + PHOTO_H + 24);
}

function paintLeadColumn(ctx: CanvasRenderingContext2D, page: FrontPage, top: number): void {
  const x = M + PHOTO_W + 26;
  const w = W - M - x;
  ctx.fillStyle = INK;
  ctx.font = `20px ${SERIF}`;
  let y = top + 20;
  for (const l of wrap(ctx, page.lead, w)) {
    ctx.fillText(l, x, y);
    y += 27;
  }
  y += 14;
  ctx.font = `italic bold 21px ${SERIF}`;
  for (const l of wrap(ctx, page.quote, w)) {
    ctx.fillText(l, x, y);
    y += 28;
  }
}

function paintBottom(ctx: CanvasRenderingContext2D, page: FrontPage, top: number): void {
  rule(ctx, top - 18, 2);
  const colW = (W - M * 2 - 40) / 3;
  page.stories.slice(0, 2).forEach((s, i) => {
    const x = M + i * (colW + 20);
    ctx.fillStyle = INK;
    ctx.font = `bold 19px ${SERIF}`;
    let y = top + 8;
    for (const l of wrap(ctx, s.title, colW).slice(0, 2)) {
      ctx.fillText(l, x, y);
      y += 24;
    }
    ctx.font = `17px ${SERIF}`;
    for (const l of wrap(ctx, s.body, colW).slice(0, 8)) {
      ctx.fillText(l, x, y + 4);
      y += 23;
    }
  });
  paintBriefs(ctx, page, top + 250, colW * 2 + 20);
  const bx = M + 2 * (colW + 20);
  box(ctx, bx, top - 6, colW, 'WEATHER', page.weather);
  box(ctx, bx, top + 130, colW, 'CLASSIFIEDS', page.classified);
}

function paintBriefs(ctx: CanvasRenderingContext2D, page: FrontPage, top: number, w: number): void {
  ctx.fillStyle = INK;
  ctx.fillRect(M, top - 26, w, 1);
  ctx.font = `bold 18px ${SERIF}`;
  ctx.fillText('IN OTHER NEWS', M, top);
  ctx.font = `17px ${SERIF}`;
  let y = top + 30;
  for (const b of page.briefs) {
    for (const l of wrap(ctx, `■ ${b}`, w)) {
      ctx.fillText(l, M, y);
      y += 24;
    }
    y += 6;
  }
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, title: string, body: string): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.font = `17px ${SERIF}`;
  const lines = wrap(ctx, body, w - 24).slice(0, 4);
  const h = 44 + lines.length * 22;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = INK;
  ctx.font = `bold 16px ${SERIF}`;
  ctx.fillText(title, x + 12, y + 26);
  ctx.font = `17px ${SERIF}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 12, y + 50 + i * 22));
}

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Crops the rendered frame to the photo aspect and tones it sepia. */
export function sepiaPhoto(frame: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = PHOTO_W;
  out.height = PHOTO_H;
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  const aspect = PHOTO_W / PHOTO_H;
  let sw = frame.width;
  let sh = sw / aspect;
  if (sh > frame.height) {
    sh = frame.height;
    sw = sh * aspect;
  }
  ctx.drawImage(frame, (frame.width - sw) / 2, (frame.height - sh) / 2, sw, sh, 0, 0, PHOTO_W, PHOTO_H);
  const img = ctx.getImageData(0, 0, PHOTO_W, PHOTO_H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = ((d[i] ?? 0) * 0.3 + (d[i + 1] ?? 0) * 0.59 + (d[i + 2] ?? 0) * 0.11) * 0.95 + 8;
    d[i] = Math.min(255, l * SEPIA[0]);
    d[i + 1] = Math.min(255, l * SEPIA[1] + 20);
    d[i + 2] = Math.min(255, l * SEPIA[2] + 24);
  }
  ctx.putImageData(img, 0, 0);
  return out;
}
