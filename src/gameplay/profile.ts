/** The player's god identity (name shown over the floating avatar and in the HUD). */
export interface Profile {
  name: string;
}

const KEY = 'goa-god-islands.profile';
const DEFAULT_NAME = 'YOU';
const MAX_NAME = 18;

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && 'name' in parsed && typeof parsed.name === 'string') {
      return { name: sanitizeName(parsed.name) };
    }
  } catch {
    // Storage can be blocked (file://, private mode): fall back to the default.
  }
  return { name: DEFAULT_NAME };
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ name: p.name }));
  } catch {
    // Non-fatal: the name simply won't persist.
  }
}

export function sanitizeName(raw: string): string {
  const clean = raw.replace(/[^\p{L}\p{N} '-]/gu, '').trim().slice(0, MAX_NAME);
  return clean.length > 0 ? clean.toUpperCase() : DEFAULT_NAME;
}
