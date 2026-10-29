// localStorage への自動保存と復元。背景画像は容量の都合で保存しない。

import { STORAGE_KEY } from './config.ts';
import {
  createDefaultBackground,
  createDefaultState,
  createSubjectId,
  type AppState,
  type PersistedState,
  type Subject,
} from './state.ts';

interface StoredData extends PersistedState {
  version: 1;
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

/** 保存データは改ざんされ得るので、長さ・形式を入力欄と同じ範囲に制限して読み込む */
const LIMITS = { subjects: 20, name: 12, score: 10, rank: 10, note: 60, examName: 40 };
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

function text(v: unknown, max: number, fallback = ''): string {
  return isString(v) ? v.slice(0, max) : fallback;
}

function parseSubject(raw: unknown, usedIds: Set<string>): Subject | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.name) || !isString(r.color) || !COLOR_PATTERN.test(r.color)) return null;
  let id = isString(r.id) && ID_PATTERN.test(r.id) ? r.id : createSubjectId();
  if (usedIds.has(id)) id = createSubjectId();
  usedIds.add(id);
  return {
    id,
    name: text(r.name, LIMITS.name),
    score: text(r.score, LIMITS.score),
    rank: text(r.rank, LIMITS.rank),
    color: r.color,
    visible: r.visible !== false,
  };
}

export function loadState(): AppState {
  const defaults = createDefaultState();
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return defaults;
    const data = JSON.parse(json) as Partial<StoredData>;
    if (data.version !== 1) return defaults;
    const usedIds = new Set<string>();
    const subjects = Array.isArray(data.subjects)
      ? data.subjects
          .slice(0, LIMITS.subjects)
          .map((s) => parseSubject(s, usedIds))
          .filter((s): s is Subject => s !== null)
      : [];
    return {
      examName: text(data.examName, LIMITS.examName, defaults.examName),
      note: text(data.note, LIMITS.note, defaults.note),
      subjects: subjects.some((s) => s.visible) ? subjects : defaults.subjects,
      background: createDefaultBackground(),
    };
  } catch {
    return defaults;
  }
}

export function saveState(state: AppState): void {
  const data: StoredData = {
    version: 1,
    examName: state.examName,
    note: state.note,
    subjects: state.subjects,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // プライベートモード等で保存できなくても動作は継続する
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無視
  }
}
