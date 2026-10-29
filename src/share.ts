// X への投稿。
// 画像を添付できるのは OS の共有シート経由のみなので、対応端末（主にスマホ）では共有シートで X を選んでもらう。
// 非対応（主に PC）では画像を保存し、本文入力済みの X 投稿画面を開いて画像を添付してもらう。

import { OUTPUT_FILENAME, SHARE_HASHTAG } from './config.ts';

/** 投稿文に載せる URL。.env の公開 URL を使い、未設定（開発時など）は現在のページ */
export function serviceUrl(): string {
  return import.meta.env.VITE_SITE_URL || `${location.origin}${location.pathname}`;
}

/** 投稿本文（URL 込み） */
export function buildPostText(examName: string): string {
  return `${examName.trim()}の成績を公開しました！\n\n${SHARE_HASHTAG}\n\n${serviceUrl()}`;
}

export function xIntentUrl(text: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text }).toString()}`;
}

function toFile(blob: Blob): File {
  return new File([blob], OUTPUT_FILENAME, { type: 'image/png' });
}

/**
 * 画像付きの共有シートで X に投稿できるか。クリック直後に同期で判定できるよう、空の PNG ファイルで確かめる。
 * PC（Windows / macOS）の共有メニューには通常 X が出ないため、タッチ操作の端末に限る。
 */
export function canShareImage(): boolean {
  if (!matchMedia('(pointer: coarse)').matches) return false;
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [toFile(new Blob([], { type: 'image/png' }))] });
  } catch {
    return false;
  }
}

export type ShareResult = 'shared' | 'cancelled' | 'not-allowed';

/**
 * 画像と本文を共有シートで共有する。
 * URL は本文に含める（url を別指定すると共有先によって本文が落ちるため）。
 */
export async function shareImage(blob: Blob, text?: string): Promise<ShareResult> {
  try {
    await navigator.share(text ? { files: [toFile(blob)], text } : { files: [toFile(blob)] });
    return 'shared';
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    // 画像生成に時間がかかりユーザー操作の有効期限が切れた場合など
    if (e instanceof DOMException && e.name === 'NotAllowedError') return 'not-allowed';
    throw e;
  }
}
