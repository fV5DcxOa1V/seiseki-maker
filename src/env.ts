// 利用環境の判定。

/** iPhone / iPad（iPadOS は Mac として名乗るためタッチ対応で見分ける） */
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * SNS・メッセージアプリ内のブラウザ（WebView）か。
 * これらでは画像の保存や共有シートが動かないことが多い。
 */
export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  return (
    /\bLine\/|Instagram|FBAN|FBAV|FB_IAB|Twitter|MicroMessenger|KAKAOTALK|TikTok|BytedanceWebview/i.test(ua) ||
    // Android の WebView は UA に "; wv)" を含む
    /Android.*;\s?wv\)/.test(ua)
  );
}

/** LINE はこのパラメータ付きの URL を外部ブラウザで開く */
export function isLine(): boolean {
  return /\bLine\//i.test(navigator.userAgent);
}
