// 入力値のバリデーションと表示用の整形。

import type { AppState } from './state.ts';

/** 全角数字・全角ピリオド・全角マイナスを半角にそろえる */
export function normalizeNumber(raw: string): string {
  return raw
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[－ー−]/g, '-');
}

/** エラーメッセージを返す。問題なければ null */
export function validateScore(raw: string): string | null {
  const value = normalizeNumber(raw);
  if (value === '') return '点数を入力してください';
  if (!/^-?\d+(\.\d+)?$/.test(value)) return '数値で入力してください（例：61.40）';
  if (value.startsWith('-')) return '0以上の値を入力してください';
  const [intPart, decPart = ''] = value.split('.');
  if (Number(intPart) >= 1000) return '999.99以下で入力してください';
  if (decPart.length > 2) return '小数点以下は2桁までにしてください';
  return null;
}

export function validateRank(raw: string): string | null {
  const value = normalizeNumber(raw);
  if (value === '') return null;
  if (!/^\d+$/.test(value) || Number(value) === 0) return '順位は1以上の整数で入力してください';
  return null;
}

export interface FormattedScore {
  integer: string;
  decimal: string;
}

/** "61.4" → { integer: "61", decimal: "40" }。不正値なら null */
export function formatScore(raw: string): FormattedScore | null {
  if (validateScore(raw)) return null;
  const [intPart, decPart = ''] = normalizeNumber(raw).split('.');
  return { integer: String(Number(intPart)), decimal: decPart.padEnd(2, '0') };
}

/** 表示する順位の数字。未入力・不正値なら null */
export function formatRank(raw: string): string | null {
  if (normalizeNumber(raw) === '' || validateRank(raw)) return null;
  return String(Number(normalizeNumber(raw)));
}

export interface ValidationResult {
  /** 画像の作成に必要な項目がそろっているか（試験名は含まない） */
  ok: boolean;
  backgroundMissing: boolean;
  /** X 投稿時のみ必須 */
  examName: string | null;
  /** subject id → エラー */
  subjects: Map<string, { score: string | null; rank: string | null }>;
}

export function validateState(state: AppState): ValidationResult {
  const subjects = new Map<string, { score: string | null; rank: string | null }>();
  let ok = state.background.image !== null;
  for (const s of state.subjects) {
    if (!s.visible) continue;
    const errors = { score: validateScore(s.score), rank: validateRank(s.rank) };
    if (errors.score || errors.rank) ok = false;
    subjects.set(s.id, errors);
  }
  return {
    ok,
    backgroundMissing: state.background.image === null,
    examName: state.examName.trim() ? null : '試験名を入力してください',
    subjects,
  };
}
