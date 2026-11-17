import { cloneRun, isRunState, type RunState } from './logic/run';

const KEY = 'low-battery-save-v1';

export type Character = 'male' | 'female';

export interface SaveData {
  muted: boolean;
  character: Character;
  /** Run snapshot taken at the start of the furthest world reached (for CONTINUE). */
  checkpoint: RunState | null;
  cleared: boolean;
}

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function defaultStore(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function defaultSave(): SaveData {
  return { muted: false, character: 'male', checkpoint: null, cleared: false };
}

export function loadSave(store: KV | null = defaultStore()): SaveData {
  const d = defaultSave();
  if (!store) return d;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<SaveData>;
    return {
      muted: typeof p.muted === 'boolean' ? p.muted : d.muted,
      character: p.character === 'female' || p.character === 'male' ? p.character : d.character,
      checkpoint: isRunState(p.checkpoint) ? cloneRun(p.checkpoint) : null,
      cleared: p.cleared === true,
    };
  } catch {
    return d;
  }
}

export function writeSave(data: SaveData, store: KV | null = defaultStore()): void {
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked: the game still works without saving */
  }
}

export function updateSave(patch: Partial<SaveData>, store: KV | null = defaultStore()): SaveData {
  const next = { ...loadSave(store), ...patch };
  writeSave(next, store);
  return next;
}
