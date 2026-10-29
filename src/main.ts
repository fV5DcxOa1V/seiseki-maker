import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';

import { CANVAS_WIDTH } from './config.ts';
import { isInAppBrowser, isIOS, isLine } from './env.ts';
import { createPngBlob, downloadBlob } from './exporter.ts';
import { initForm } from './form.ts';
import { loadFontsFor, renderScene } from './renderer.ts';
import { buildPostText, canShareImage, serviceUrl, shareImage, xIntentUrl } from './share.ts';
import { createDefaultState, Store, type AppState } from './state.ts';
import { clearState, loadState, saveState } from './storage.ts';
import { validateState } from './validation.ts';

const store = new Store(loadState());

// ---------- ステータス表示 ----------

const statusEl = document.getElementById('status')!;

function showStatus(type: 'success' | 'danger' | 'info', message: string, link?: { href: string; label: string }): void {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} mb-0`;
  const p = document.createElement('p');
  p.className = 'mb-0';
  p.textContent = message;
  alert.append(p);
  if (link) {
    const a = document.createElement('a');
    a.className = 'btn btn-dark mt-2 w-100';
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = link.label;
    alert.append(a);
  }
  statusEl.replaceChildren(alert);
  showingInputError = false;
}

/** 入力エラーの案内を表示中か（エラーが解消したら自動で消すため） */
let showingInputError = false;

function clearStatus(): void {
  statusEl.replaceChildren();
}

const form = initForm(store, (message) => showStatus('danger', message));

// ---------- プレビュー描画 ----------

const preview = document.getElementById('preview') as HTMLCanvasElement;
const previewCtx = preview.getContext('2d')!;
const mini = document.getElementById('bg-mini') as HTMLCanvasElement;
const miniCtx = mini.getContext('2d')!;

let frame = 0;
function scheduleRender(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const state = store.get();
    renderScene(previewCtx, state);
    mini.hidden = !state.background.image;
    if (!mini.hidden) renderScene(miniCtx, state, mini.width / CANVAS_WIDTH);
  });
}

/** Web フォントは使う文字ごとに読み込まれるので、読み込み完了後に描き直す */
let fontKey = '';
function ensureFonts(state: AppState): void {
  const key = state.subjects.map((s) => s.name).join('|') + state.note;
  if (key === fontKey) return;
  fontKey = key;
  void loadFontsFor(state).then(scheduleRender);
}

// ---------- 共有用 PNG のキャッシュ ----------
// iOS Safari などは共有シートをクリック直後に開かないと拒否するため、事前に PNG を作っておく。

let cachedBlob: Blob | null = null;
let blobTimer = 0;
let blobVersion = 0;

function invalidateBlob(state: AppState): void {
  cachedBlob = null;
  blobVersion += 1;
  clearTimeout(blobTimer);
  if (!validateState(state).ok) return;
  const version = blobVersion;
  blobTimer = window.setTimeout(async () => {
    try {
      const blob = await createPngBlob(store.get());
      if (version === blobVersion) cachedBlob = blob;
    } catch {
      // クリック時に再生成する
    }
  }, 600);
}

async function getBlob(): Promise<Blob> {
  if (cachedBlob) return cachedBlob;
  const version = blobVersion;
  const blob = await createPngBlob(store.get());
  if (version === blobVersion) cachedBlob = blob;
  return blob;
}

// ---------- 長押し保存用の画像表示 ----------

const resultPanel = document.getElementById('result-panel')!;
const resultImage = document.getElementById('result-image') as HTMLImageElement;

/** 作成した画像を表示し、長押しで保存してもらう */
function showResultImage(blob: Blob): void {
  hideResultImage();
  resultImage.src = URL.createObjectURL(blob);
  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** 入力が変わると画像が古くなるので隠す */
function hideResultImage(): void {
  if (resultPanel.hidden) return;
  URL.revokeObjectURL(resultImage.src);
  resultImage.removeAttribute('src');
  resultPanel.hidden = true;
}

// ---------- 状態変化への反応 ----------

let saveTimer = 0;

function onStateChange(state: AppState): void {
  scheduleRender();
  ensureFonts(state);
  invalidateBlob(state);
  hideResultImage();
  const result = validateState(state);
  form.showValidation(result);
  if (showingInputError && result.ok && !result.examName) clearStatus();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveState(store.get()), 300);
}

store.subscribe(onStateChange);
form.syncFromState();
onStateChange(store.get());

// ---------- ボタン ----------

/** エラーがあれば表示して false を返す。X 投稿時は試験名も必須 */
function checkInput(mode: 'save' | 'post'): boolean {
  const result = validateState(store.get());
  form.showValidation(result, mode);
  if (result.ok && (mode === 'save' || !result.examName)) return true;
  showStatus('danger', '入力内容に不足や誤りがあります。赤く表示された項目を確認してください。');
  showingInputError = true;
  form.focusFirstError();
  return false;
}

const saveBtn = document.getElementById('btn-save') as HTMLButtonElement;
const postBtn = document.getElementById('btn-share') as HTMLButtonElement;

// ---------- 保存方法の切り替え ----------
// iPhone：ダウンロードだと「ファイル」アプリに入るため、共有シートの「画像を保存」で写真アプリへ。
// アプリ内ブラウザ・共有シート非対応の iPhone：ダウンロードが効かないことが多いため、画像を表示して長押しで保存。
// それ以外（PC・Android の Chrome など）：ダウンロード。

type SaveMethod = 'share-sheet' | 'long-press' | 'download';

function saveMethod(): SaveMethod {
  if (isIOS() && canShareImage()) return 'share-sheet';
  if (isIOS() || isInAppBrowser()) return 'long-press';
  return 'download';
}

document.getElementById('save-hint')!.hidden = saveMethod() !== 'share-sheet';
// PC では投稿画面を開くと同時に画像を保存するため、事前に知らせておく
document.getElementById('post-hint')!.hidden = canShareImage() || saveMethod() !== 'download';

saveBtn.addEventListener('click', async () => {
  if (!checkInput('save')) return;
  saveBtn.disabled = true;
  let blob: Blob | null = null;
  try {
    blob = await getBlob();
    const method = saveMethod();
    if (method === 'share-sheet') {
      const result = await shareImage(blob);
      if (result === 'not-allowed') showStatus('info', '画像の準備ができました。もう一度「画像を保存」を押してください。');
      else clearStatus();
    } else if (method === 'long-press') {
      clearStatus();
      showResultImage(blob);
    } else {
      downloadBlob(blob);
      showStatus('success', '画像を保存しました。');
    }
  } catch {
    if (blob) {
      // 共有シートが使えなかった場合は長押し保存に切り替える
      clearStatus();
      showResultImage(blob);
    } else {
      showStatus('danger', '画像の作成に失敗しました。もう一度お試しください。');
    }
  } finally {
    saveBtn.disabled = false;
  }
});

postBtn.addEventListener('click', async () => {
  if (!checkInput('post')) return;
  const text = buildPostText(store.get().examName);
  const intent = xIntentUrl(text);
  const xLink = { href: intent, label: 'Xの投稿画面を開く' };

  // スマホ：共有シートで画像と本文を渡し、X を選んでもらう（画像を添付できるのはこの方法だけ）
  if (canShareImage()) {
    postBtn.disabled = true;
    let blob: Blob | null = null;
    try {
      blob = await getBlob();
      const result = await shareImage(blob, text);
      if (result === 'shared') showStatus('success', '投稿の準備ができました。');
      else if (result === 'not-allowed') showStatus('info', '画像の準備ができました。もう一度「Xに投稿する」を押してください。');
      else clearStatus();
    } catch {
      showStatus('info', '共有メニューを開けませんでした。下の画像を長押しして保存してから、Xの投稿画面で添付してください。', xLink);
      if (blob) showResultImage(blob);
    } finally {
      postBtn.disabled = false;
    }
    return;
  }

  // 共有シート非対応のスマホ・アプリ内ブラウザ：画像を長押しで保存してもらい、投稿画面はボタンから開く
  if (saveMethod() === 'long-press') {
    postBtn.disabled = true;
    try {
      const blob = await getBlob();
      showStatus('info', '下の画像を長押しして保存してから、Xの投稿画面を開いて添付してください。', xLink);
      showResultImage(blob);
    } catch {
      showStatus('danger', '画像の作成に失敗しました。もう一度お試しください。');
    } finally {
      postBtn.disabled = false;
    }
    return;
  }

  // PC：X の投稿画面を開き、画像は保存して添付してもらう。
  // ポップアップブロックを避けるため、画面はクリック直後に同期で開く。
  // noopener を指定すると戻り値が常に null になり開けたか判定できないため、開いた後に切り離す
  const opened = window.open(intent, '_blank');
  if (opened) opened.opener = null;
  postBtn.disabled = true;
  try {
    downloadBlob(await getBlob());
    if (opened) {
      showStatus('info', '画像を保存しました。開いたXの投稿画面で、保存した画像を添付して投稿してください。');
    } else {
      showStatus('info', '画像を保存しました。下のボタンからXの投稿画面を開き、保存した画像を添付して投稿してください。', xLink);
    }
  } catch {
    showStatus('danger', '画像の作成に失敗しました。もう一度お試しください。');
  } finally {
    postBtn.disabled = false;
  }
});

document.getElementById('btn-reset')!.addEventListener('click', () => {
  if (!window.confirm('入力内容と背景画像をすべて消去して、初期状態に戻しますか？')) return;
  const image = store.get().background.image;
  if (image) URL.revokeObjectURL(image.src);
  store.replace(createDefaultState());
  clearTimeout(saveTimer);
  clearState();
  form.syncFromState();
  form.showValidation(validateState(store.get()));
  clearStatus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------- アプリ内ブラウザの案内 ----------

if (isInAppBrowser()) {
  const notice = document.getElementById('in-app-notice')!;
  notice.hidden = false;
  const pageUrl = serviceUrl();

  if (isLine()) {
    const open = document.getElementById('in-app-open') as HTMLAnchorElement;
    open.href = `${pageUrl}?openExternalBrowser=1`;
    open.hidden = false;
  }

  const copyBtn = document.getElementById('in-app-copy') as HTMLButtonElement;
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      copyBtn.textContent = 'コピーしました';
    } catch {
      // クリップボードが使えない WebView では URL を表示して手動でコピーしてもらう
      window.prompt('このURLをコピーして、ブラウザで開いてください', pageUrl);
    }
  });
}
