// 総合の自動計算。表示中の科目の点数を配点で加重平均する。

import { visibleSubjects, type AppState } from './state.ts';
import { formatScore } from './validation.ts';

/** 小数の誤差を避けるため 0.01 点単位の整数にする。不正値なら null */
function toHundredths(raw: string): number | null {
  const score = formatScore(raw);
  if (!score) return null;
  return Number(score.integer) * 100 + Number(score.decimal);
}

/**
 * 総合の点数（"57.71" の形）を求める。
 * 削除した科目は含めない。未入力・不正な点数の科目があれば計算できないので null。
 */
export function computeTotalScore(state: AppState): string | null {
  const subjects = visibleSubjects(state).filter((s) => !s.isTotal && s.weight > 0);
  if (subjects.length === 0) return null;
  let sum = 0;
  let weights = 0;
  for (const s of subjects) {
    const value = toHundredths(s.score);
    if (value === null) return null;
    sum += value * s.weight;
    weights += s.weight;
  }
  const average = Math.round(sum / weights);
  return `${Math.floor(average / 100)}.${String(average % 100).padStart(2, '0')}`;
}

/**
 * 配点の説明（例：「会計学300点、その他100点」）。
 * 最も多い配点を「その他」にまとめ、それ以外の科目だけ名前を出す。
 */
export function describeWeights(state: AppState): string {
  const subjects = visibleSubjects(state).filter((s) => !s.isTotal && s.weight > 0);
  if (subjects.length === 0) return '';
  const counts = new Map<number, number>();
  for (const s of subjects) counts.set(s.weight, (counts.get(s.weight) ?? 0) + 1);
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const others = subjects.filter((s) => s.weight !== common);
  if (others.length === 0) return `各科目${common}点`;
  return [...others.map((s) => `${s.name || '名称未設定'}${s.weight}点`), `その他${common}点`].join('、');
}
