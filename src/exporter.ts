// PNG 生成と保存。

import { CANVAS_HEIGHT, CANVAS_WIDTH, OUTPUT_FILENAME } from './config.ts';
import { loadFontsFor, renderScene } from './renderer.ts';
import type { AppState } from './state.ts';

/** プレビューと同じ描画ロジックで、出力用 Canvas に描いて PNG を作る */
export async function createPngBlob(state: AppState): Promise<Blob> {
  await loadFontsFor(state);
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas を利用できません');
  renderScene(ctx, state);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG を生成できませんでした'))), 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename = OUTPUT_FILENAME): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
