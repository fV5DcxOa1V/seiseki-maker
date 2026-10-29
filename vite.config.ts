import { defineConfig, type Plugin } from 'vite';

/**
 * Content Security Policy。GitHub Pages では HTTP ヘッダーを設定できないため meta タグで指定する。
 * 開発サーバーはスタイルをインラインで注入するので、本番ビルドにだけ付与する。
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' blob: data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }];
    },
  };
}

// GitHub Pages のサブパス（/seiseki-maker/）でも動くよう相対パスで出力する
export default defineConfig({
  base: './',
  plugins: [cspPlugin()],
});
