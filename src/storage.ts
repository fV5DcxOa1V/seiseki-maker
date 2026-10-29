// localStorage への自動保存と復元。背景画像は容量の都合で保存しない。

import { DEFAULT_SUBJECTS, STORAGE_KEY, type SubjectPreset } from './config.ts';
import {
  createDefaultBackground,
  createDefaultState,
  createSubjectId,
  type AppState,
  type PersistedState,
  type Subject,
} from './state.ts';

/**
 * 保存形式の版。
 * 1：配点・総合の印なし（総合も普通の科目）
 * 2：科目ごとに配点（weight）と総合の印（isTotal）を持つ
 */
const VERSION = 2;

interface StoredData extends PersistedState {
  version: 1 | 2;
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

const MAX_WEIGHT = 1000;

/**
 * preset は版1のデータを移行するときの、同じ位置の初期科目。
 * 版1には科目の追加・並び替えがないため、位置で初期科目と対応づけられる。
 */
function parseSubject(raw: unknown, usedIds: Set<string>, preset?: SubjectPreset): Subject | null {
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
    weight:
      typeof r.weight === 'number' && Number.isFinite(r.weight) && r.weight >= 0 && r.weight <= MAX_WEIGHT
        ? r.weight
        : (preset?.weight ?? 100),
    isTotal: typeof r.isTotal === 'boolean' ? r.isTotal : (preset?.isTotal ?? false),
    manual: r.manual === true,
  };
}

export function loadState(): AppState {
  const defaults = createDefaultState();
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return defaults;
    const data = JSON.parse(json) as Partial<StoredData>;
    if (data.version !== 1 && data.version !== VERSION) return defaults;
    const usedIds = new Set<string>();
    const raw = Array.isArray(data.subjects) ? data.subjects.slice(0, LIMITS.subjects) : [];
    const migrate = data.version === 1 && raw.length === DEFAULT_SUBJECTS.length;
    const subjects = raw
      .map((s, i) => parseSubject(s, usedIds, migrate ? DEFAULT_SUBJECTS[i] : undefined))
      .filter((s): s is Subject => s !== null);
    // 総合欄は1つまで
    let seenTotal = false;
    for (const s of subjects) {
      if (s.isTotal && seenTotal) s.isTotal = false;
      if (s.isTotal) seenTotal = true;
    }
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
    version: VERSION,
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
