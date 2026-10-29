// データ管理。アプリの状態を1か所に持ち、変更を購読者へ通知する。

import { DEFAULT_SUBJECTS, DEFAULT_TEXT } from './config.ts';

export interface Subject {
  id: string;
  name: string;
  /** 入力されたままの文字列。表示時に整形する */
  score: string;
  /** 入力されたままの文字列。空なら順位非表示 */
  rank: string;
  color: string;
  visible: boolean;
  /** 総合の加重平均に使う配点（総合欄は 0） */
  weight: number;
  /** 総合欄か。科目の点数が変わると自動で再計算される（直接編集も可） */
  isTotal: boolean;
  /** 総合欄を手入力中か。手で書き換えると true になり、以後は自動計算で上書きしない */
  manual: boolean;
}

export interface BackgroundState {
  image: HTMLImageElement | null;
  /** cover 配置を 1 とした拡大率 */
  zoom: number;
  /** -1〜1。はみ出し量に対する位置（-1 で左端／上端、1 で右端／下端） */
  offsetX: number;
  offsetY: number;
}

export interface AppState {
  examName: string;
  note: string;
  subjects: Subject[];
  background: BackgroundState;
}

/** localStorage に保存する部分（画像を除く） */
export type PersistedState = Omit<AppState, 'background'>;

let idCounter = 0;
export function createSubjectId(): string {
  idCounter += 1;
  return `s${Date.now().toString(36)}${idCounter}`;
}

export function createDefaultBackground(): BackgroundState {
  return { image: null, zoom: 1, offsetX: 0, offsetY: 0 };
}

export function createDefaultState(): AppState {
  return {
    ...DEFAULT_TEXT,
    subjects: DEFAULT_SUBJECTS.map((preset) => ({
      id: createSubjectId(),
      name: preset.name,
      score: '',
      rank: '',
      color: preset.color,
      visible: true,
      weight: preset.weight,
      isTotal: preset.isTotal ?? false,
      manual: false,
    })),
    background: createDefaultBackground(),
  };
}

export function visibleSubjects(state: AppState): Subject[] {
  return state.subjects.filter((s) => s.visible);
}

type Listener = (state: AppState) => void;

export class Store {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor(initial: AppState) {
    this.state = initial;
  }

  get(): AppState {
    return this.state;
  }

  /** state を直接書き換える関数を受け取り、変更後に通知する */
  update(mutate: (state: AppState) => void): void {
    mutate(this.state);
    this.listeners.forEach((fn) => fn(this.state));
  }

  replace(next: AppState): void {
    this.state = next;
    this.listeners.forEach((fn) => fn(this.state));
  }

  updateSubject(id: string, patch: Partial<Omit<Subject, 'id'>>): void {
    this.update((state) => {
      const subject = state.subjects.find((s) => s.id === id);
      if (subject) Object.assign(subject, patch);
    });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
