// 入力フォーム。DOM の入力を Store に反映し、Store の内容をフォームに表示する。

import { BACKGROUND_ZOOM } from './config.ts';
import { createDefaultBackground, type Store, type Subject } from './state.ts';
import { computeTotalScore, describeWeights } from './total.ts';
import type { ValidationResult } from './validation.ts';

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el as T;
}

/** 端末のメモリ不足でページが落ちないよう、極端に大きい画像は受け付けない */
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_PIXELS = 50_000_000;

function loadImageFile(file: File): Promise<HTMLImageElement> {
  // SVG は Canvas を汚染して PNG 出力できなくなる場合があるため写真形式に限る
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return Promise.reject(new Error('写真などの画像ファイル（JPEG・PNG など）を選択してください'));
  }
  if (file.size > MAX_FILE_BYTES) {
    return Promise.reject(new Error('画像のファイルサイズが大きすぎます（30MBまで）'));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth * img.naturalHeight > MAX_PIXELS) {
        URL.revokeObjectURL(url);
        reject(new Error('画像の解像度が大きすぎます。縮小してから選択してください'));
        return;
      }
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像を読み込めませんでした'));
    };
    img.src = url;
  });
}

export interface FormController {
  /** Store の内容でフォーム全体を描き直す（初期化・リセット時） */
  syncFromState(): void;
  /**
   * バリデーション結果を表示する。mode を指定すると未操作の欄も表示する
   * （'save'：画像保存時、'post'：X 投稿時。投稿時は試験名も必須）
   */
  showValidation(result: ValidationResult, mode?: 'save' | 'post'): void;
  /** 最初のエラー欄へフォーカスする */
  focusFirstError(): void;
}

export function initForm(store: Store, onError: (message: string) => void): FormController {
  const bgFile = $<HTMLInputElement>('bg-file');
  const bgAdjust = $<HTMLFieldSetElement>('bg-adjust');
  const bgZoom = $<HTMLInputElement>('bg-zoom');
  const bgX = $<HTMLInputElement>('bg-x');
  const bgY = $<HTMLInputElement>('bg-y');
  const subjectList = $<HTMLDivElement>('subject-list');
  const hiddenWrap = $<HTMLDivElement>('hidden-subjects');
  const hiddenList = $<HTMLDivElement>('hidden-subject-list');
  const note = $<HTMLInputElement>('note');
  const examName = $<HTMLInputElement>('exam-name');
  const template = $<HTMLTemplateElement>('subject-template');

  // Enter キーで送信（ページ再読み込み）されないようにする
  $<HTMLFormElement>('editor').addEventListener('submit', (e) => e.preventDefault());

  /** 一度でも操作された欄だけエラー表示する（初期表示で赤くしないため） */
  const touched = new Set<string>();
  let showAllErrors = false;
  /** 試験名は X 投稿時のみ必須なので、投稿を試みたときだけ全件表示に含める */
  let showExamNameError = false;
  let lastResult: ValidationResult | null = null;

  // ---------- 背景 ----------

  bgFile.addEventListener('change', async () => {
    const file = bgFile.files?.[0];
    if (!file) return;
    try {
      const image = await loadImageFile(file);
      const prev = store.get().background.image;
      if (prev) URL.revokeObjectURL(prev.src);
      store.update((s) => {
        s.background = { ...createDefaultBackground(), image };
      });
      syncBackground();
    } catch (e) {
      bgFile.value = '';
      onError(e instanceof Error ? e.message : '画像を読み込めませんでした');
    }
  });

  bgZoom.addEventListener('input', () => {
    store.update((s) => {
      s.background.zoom = Number(bgZoom.value) / 100;
    });
  });
  bgX.addEventListener('input', () => {
    store.update((s) => {
      s.background.offsetX = Number(bgX.value) / 100;
    });
  });
  bgY.addEventListener('input', () => {
    store.update((s) => {
      s.background.offsetY = Number(bgY.value) / 100;
    });
  });
  $('bg-adjust-reset').addEventListener('click', () => {
    store.update((s) => {
      s.background = { ...createDefaultBackground(), image: s.background.image };
    });
    syncBackground();
  });

  function syncBackground(): void {
    const bg = store.get().background;
    if (!bg.image) bgFile.value = '';
    bgAdjust.disabled = !bg.image;
    bgZoom.min = String(BACKGROUND_ZOOM.min * 100);
    bgZoom.max = String(BACKGROUND_ZOOM.max * 100);
    bgZoom.value = String(Math.round(bg.zoom * 100));
    bgX.value = String(Math.round(bg.offsetX * 100));
    bgY.value = String(Math.round(bg.offsetY * 100));
  }

  // ---------- 科目 ----------

  function renderSubjects(): void {
    const subjects = store.get().subjects;
    const visible = subjects.filter((s) => s.visible);
    subjectList.replaceChildren(...visible.map((s, i) => buildSubjectCard(s, i, visible.length)));

    const hidden = subjects.filter((s) => !s.visible);
    hiddenWrap.hidden = hidden.length === 0;
    hiddenList.replaceChildren(
      ...hidden.map((s) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline-secondary btn-sm';
        btn.textContent = `「${s.name || '名称未設定'}」を戻す`;
        btn.addEventListener('click', () => {
          store.updateSubject(s.id, { visible: true });
          recalcTotal();
          renderSubjects();
        });
        return btn;
      }),
    );
    refreshTotalHelp();
    if (lastResult) applyValidation(lastResult);
  }

  function buildSubjectCard(subject: Subject, index: number, visibleCount: number): HTMLElement {
    const card = (template.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLFieldSetElement;
    card.dataset.id = subject.id;
    card.style.setProperty('--subject-color', subject.color);

    const legendText = card.querySelector<HTMLElement>('.subject-legend-text')!;
    const removeBtn = card.querySelector<HTMLButtonElement>('[data-action="remove"]')!;
    const updateLabels = (name: string) => {
      legendText.textContent = `${index + 1}. ${name || '名称未設定'}`;
      removeBtn.textContent = 'この科目を削除';
      removeBtn.setAttribute('aria-label', `「${name || '名称未設定'}」を削除`);
    };
    updateLabels(subject.name);

    for (const field of ['name', 'score', 'rank'] as const) {
      const input = card.querySelector<HTMLInputElement>(`[data-field="${field}"]`)!;
      const label = card.querySelector<HTMLLabelElement>(`[data-for="${field}"]`)!;
      const id = `subject-${subject.id}-${field}`;
      input.id = id;
      label.htmlFor = id;
      input.value = subject[field];
      const feedback = card.querySelector<HTMLElement>(`[data-feedback="${field}"]`);
      if (feedback) {
        feedback.id = `${id}-feedback`;
        input.setAttribute('aria-describedby', feedback.id);
      }
      input.addEventListener('input', () => {
        touched.add(`${subject.id}:${field}`);
        if (field === 'name') updateLabels(input.value);
        if (field === 'score' && subject.isTotal) {
          // 総合を手で書き換えたら手入力に切り替え、以後は自動計算で上書きしない
          store.updateSubject(subject.id, { score: input.value, manual: true });
          refreshTotalHelp();
          return;
        }
        store.updateSubject(subject.id, { [field]: input.value });
        if (field === 'score') recalcTotal();
        if (field === 'name') refreshTotalHelp();
      });
      input.addEventListener('blur', () => {
        touched.add(`${subject.id}:${field}`);
        if (lastResult) applyValidation(lastResult);
      });
    }

    // 最後の1科目は削除できない
    removeBtn.disabled = visibleCount <= 1;
    removeBtn.addEventListener('click', () => {
      store.updateSubject(subject.id, { visible: false });
      recalcTotal();
      renderSubjects();
    });

    if (subject.isTotal) {
      const scoreInput = card.querySelector<HTMLInputElement>('[data-field="score"]')!;
      const help = document.createElement('div');
      help.id = `subject-${subject.id}-total-help`;
      help.className = 'form-text';
      help.dataset.totalHelp = '';
      const autoBtn = document.createElement('button');
      autoBtn.type = 'button';
      autoBtn.className = 'btn btn-outline-secondary btn-sm';
      autoBtn.textContent = '自動計算に戻す';
      autoBtn.dataset.totalAuto = '';
      autoBtn.addEventListener('click', () => {
        store.updateSubject(subject.id, { manual: false });
        recalcTotal();
        refreshTotalHelp();
      });
      // 「自動計算に戻す」と「この科目を削除」を1つの行に並べて位置をそろえる
      const actions = document.createElement('div');
      actions.className = 'd-flex flex-wrap gap-2 mt-2';
      removeBtn.classList.remove('mt-2');
      actions.append(autoBtn, removeBtn);
      card.querySelector('.row')!.after(help, actions);
      scoreInput.setAttribute('aria-describedby', `${scoreInput.getAttribute('aria-describedby')} ${help.id}`);
    }
    return card;
  }

  /** 総合欄の説明を、自動計算中か手入力中かに合わせて切り替える */
  function refreshTotalHelp(): void {
    const state = store.get();
    const total = state.subjects.find((s) => s.isTotal && s.visible);
    if (!total) return;
    const card = subjectList.querySelector<HTMLElement>(`[data-id="${total.id}"]`);
    const help = card?.querySelector<HTMLElement>('[data-total-help]');
    const autoBtn = card?.querySelector<HTMLButtonElement>('[data-total-auto]');
    if (!help || !autoBtn) return;
    const weights = describeWeights(state);
    help.textContent = total.manual
      ? '手入力：科目の点数を変えても更新されません。'
      : `自動計算（論文式の配点${weights ? `：${weights}` : ''}）。総合を書き換えると手入力に切り替わります。`;
    autoBtn.hidden = !total.manual;
  }

  /**
   * 総合を加重平均で更新する。手入力中は上書きしない。
   * 計算できない（未入力・不正値がある）ときは、総合をそのままにする。
   */
  function recalcTotal(): void {
    const state = store.get();
    const total = state.subjects.find((s) => s.isTotal && s.visible);
    if (!total || total.manual) return;
    const score = computeTotalScore(state);
    if (score === null || score === total.score) return;
    store.updateSubject(total.id, { score });
    const input = subjectList.querySelector<HTMLInputElement>(`[data-id="${total.id}"] [data-field="score"]`);
    if (input) input.value = score;
  }

  // ---------- テキスト ----------

  note.addEventListener('input', () => store.update((s) => void (s.note = note.value)));
  examName.addEventListener('input', () => {
    touched.add('examName');
    store.update((s) => void (s.examName = examName.value));
  });

  // ---------- バリデーション表示 ----------

  function setFieldError(input: HTMLInputElement, message: string | null, show: boolean): void {
    const invalid = show && message !== null;
    input.classList.toggle('is-invalid', invalid);
    input.setAttribute('aria-invalid', String(invalid));
    const feedback = input.parentElement?.querySelector<HTMLElement>('.invalid-feedback');
    if (feedback) feedback.textContent = invalid ? message : '';
  }

  function applyValidation(result: ValidationResult): void {
    lastResult = result;
    setFieldError(bgFile, result.backgroundMissing ? '背景画像を選択してください' : null, showAllErrors);
    setFieldError(examName, result.examName, showExamNameError || touched.has('examName'));
    for (const card of subjectList.querySelectorAll<HTMLElement>('.subject-card')) {
      const id = card.dataset.id!;
      const errors = result.subjects.get(id);
      if (!errors) continue;
      for (const field of ['name', 'score', 'rank'] as const) {
        const input = card.querySelector<HTMLInputElement>(`[data-field="${field}"]`)!;
        setFieldError(input, errors[field], showAllErrors || touched.has(`${id}:${field}`));
      }
    }
  }

  return {
    syncFromState() {
      const s = store.get();
      touched.clear();
      showAllErrors = false;
      showExamNameError = false;
      note.value = s.note;
      examName.value = s.examName;
      syncBackground();
      renderSubjects();
    },
    showValidation(result, mode) {
      if (mode) showAllErrors = true;
      if (mode === 'post') showExamNameError = true;
      // エラーが解消したら全件表示モードを解除する
      if (result.ok) showAllErrors = false;
      if (!result.examName) showExamNameError = false;
      applyValidation(result);
    },
    focusFirstError() {
      const first = document.querySelector<HTMLInputElement>('#editor .is-invalid');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first?.focus({ preventScroll: true });
    },
  };
}
