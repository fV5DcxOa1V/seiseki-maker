// Canvas 描画。プレビューと PNG 出力で同じ関数を使う。
// 描画はすべて 1600×900 の論理座標で行い、scale で縮小描画にも対応する。

import { CANVAS_HEIGHT, CANVAS_WIDTH, FONT_FAMILY, LAYOUT, TILE_FONT_FAMILY } from './config.ts';
import { visibleSubjects, type AppState, type BackgroundState, type Subject } from './state.ts';
import { formatRank, formatScore } from './validation.ts';

const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;

/** 横方向の圧縮はここまで。これ以上はみ出す場合はフォント全体を縮小する */
const MIN_COMPRESS_X = 0.78;

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

function tileFont(size: number): string {
  return `900 ${size}px ${TILE_FONT_FAMILY}`;
}

export function renderScene(ctx: CanvasRenderingContext2D, state: AppState, scale = 1): void {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, state.background);
  const hasNote = state.note.trim() !== '';
  drawTiles(ctx, visibleSubjects(state), hasNote);
  if (hasNote) drawNote(ctx, state.note);
  ctx.restore();
}

// ---------- 背景 ----------

/** cover 配置に拡大率と位置を反映した描画矩形。常に出力範囲を覆う */
export function backgroundRect(bg: BackgroundState) {
  const img = bg.image!;
  const base = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const s = base * bg.zoom;
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  const slackX = w - W;
  const slackY = h - H;
  return {
    x: (-slackX / 2) * (1 + bg.offsetX),
    y: (-slackY / 2) * (1 + bg.offsetY),
    w,
    h,
    slackX,
    slackY,
  };
}

function drawBackground(ctx: CanvasRenderingContext2D, bg: BackgroundState): void {
  if (!bg.image) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3a4452');
    g.addColorStop(1, '#151a21');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = font(700, 44);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('背景画像を選択してください', W / 2, 260);
    return;
  }
  const r = backgroundRect(bg);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bg.image, r.x, r.y, r.w, r.h);
}

// ---------- タイル ----------

/** タイル列を描画する。注記がある場合は注記の分だけ上に寄せる */
function drawTiles(ctx: CanvasRenderingContext2D, subjects: Subject[], hasNote: boolean): void {
  const marginBottom = hasNote ? LAYOUT.marginBottomWithNote : LAYOUT.marginBottom;
  const top = H - marginBottom - LAYOUT.tileHeight;
  const n = subjects.length;
  if (n === 0) return;
  const tileW = (W - LAYOUT.marginX * 2 - LAYOUT.tileGap * (n - 1)) / n;
  subjects.forEach((s, i) => {
    const x = LAYOUT.marginX + i * (tileW + LAYOUT.tileGap);
    drawTile(ctx, s, x, top, tileW, LAYOUT.tileHeight);
  });
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  subject: Subject,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const b = LAYOUT.tileBorder;

  // 白枠（影付き）
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  // 濃い背景色（上を少し明るくしたグラデーション）
  const g = ctx.createLinearGradient(0, y + b, 0, y + h - b);
  g.addColorStop(0, shade(subject.color, 0.14));
  g.addColorStop(0.55, subject.color);
  g.addColorStop(1, shade(subject.color, -0.22));
  ctx.fillStyle = g;
  ctx.fillRect(x + b, y + b, w - b * 2, h - b * 2);

  const cx = x + w / 2;
  const maxW = w - b * 2 - LAYOUT.tilePaddingX * 2;
  const rank = formatRank(subject.rank);

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // 科目名
  const name = subject.name.trim();
  if (name) {
    const size = LAYOUT.nameFontSize;
    ctx.font = tileFont(size);
    const nameW = ctx.measureText(name).width;
    drawFitted(ctx, nameW, maxW, cx, y + LAYOUT.nameCenterY + size * 0.36, 'center', (left) => {
      ctx.fillText(name, left, 0);
    });
  }

  // 点数
  const size = rank ? LAYOUT.scoreFontSize : LAYOUT.scoreFontSizeNoRank;
  const baseline = y + (rank ? LAYOUT.scoreBaselineY : LAYOUT.scoreBaselineYNoRank);
  drawScore(ctx, subject.score, size, cx, baseline, maxW);

  // 区切り線と順位（未入力なら領域ごと描かない）
  if (rank) {
    ctx.fillRect(
      x + b + LAYOUT.separatorInset,
      y + LAYOUT.separatorY - LAYOUT.separatorWidth / 2,
      w - (b + LAYOUT.separatorInset) * 2,
      LAYOUT.separatorWidth,
    );
    drawRank(ctx, rank, x + w - b - LAYOUT.rankPaddingRight, y + LAYOUT.rankBaselineY, maxW);
  }
  ctx.restore();
}

/** 整数部を大きく描き、その右に小数部（上段）と「点」（下段）を縦に積む */
function drawScore(
  ctx: CanvasRenderingContext2D,
  raw: string,
  size: number,
  cx: number,
  baseline: number,
  maxW: number,
): void {
  const score = formatScore(raw);
  const integer = score?.integer ?? '--';
  const decimal = `.${score?.decimal ?? '--'}`;
  const intFont = tileFont(size);
  const decFont = tileFont(size * LAYOUT.scoreDecimalRatio);
  const unitFont = tileFont(size * LAYOUT.scoreUnitRatio);

  ctx.font = intFont;
  const intW = ctx.measureText(integer).width;
  ctx.font = decFont;
  const decW = ctx.measureText(decimal).width;
  ctx.font = unitFont;
  const unitW = ctx.measureText('点').width;
  const gap = size * LAYOUT.scoreColumnGap;
  const colW = Math.max(decW, unitW);
  const total = intW + gap + colW;

  drawFitted(ctx, total, maxW, cx, baseline, 'center', (left) => {
    ctx.font = intFont;
    ctx.fillText(integer, left, 0);
    const colCenter = left + intW + gap + colW / 2;
    ctx.font = decFont;
    ctx.fillText(decimal, colCenter - decW / 2, -size * LAYOUT.scoreDecimalRise);
    ctx.font = unitFont;
    ctx.fillText('点', colCenter - unitW / 2, 0);
  });
}

/** 「237 位」のように数字と「位」を間隔をあけて右寄せで描く */
function drawRank(
  ctx: CanvasRenderingContext2D,
  rank: string,
  right: number,
  baseline: number,
  maxW: number,
): void {
  const numFont = tileFont(LAYOUT.rankFontSize);
  const unitFont = tileFont(LAYOUT.rankUnitFontSize);
  ctx.font = numFont;
  const numW = ctx.measureText(rank).width;
  ctx.font = unitFont;
  const unitW = ctx.measureText('位').width;
  const total = numW + LAYOUT.rankUnitGap + unitW;
  drawFitted(ctx, total, maxW, right, baseline, 'right', (left) => {
    ctx.font = numFont;
    ctx.fillText(rank, left, 0);
    ctx.font = unitFont;
    ctx.fillText('位', left + numW + LAYOUT.rankUnitGap, 0);
  });
}

// ---------- 注記 ----------

function drawNote(ctx: CanvasRenderingContext2D, note: string): void {
  const text = note.trim();
  const size = LAYOUT.noteFontSize;
  const right = W - LAYOUT.marginX;
  const baseline = H - LAYOUT.noteBaselineFromBottom;
  ctx.save();
  ctx.font = font(900, size);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const width = ctx.measureText(text).width;
  const maxW = W - LAYOUT.marginX * 2;
  const k = Math.min(1, maxW / width);
  ctx.translate(right, baseline);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(text, -width, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, -width, 0);
  ctx.restore();
}

// ---------- ヘルパー ----------

/**
 * 幅 total の要素群を maxW に収まるよう縮めて描画する。
 * 幅が足りない場合はまず横方向に圧縮し、それでも足りなければ全体を縮小する。
 * draw にはベースラインを y=0 とした座標系での左端 x が渡される。
 */
function drawFitted(
  ctx: CanvasRenderingContext2D,
  total: number,
  maxW: number,
  anchorX: number,
  baseline: number,
  align: 'center' | 'right',
  draw: (left: number) => void,
): void {
  let sx = 1;
  let k = 1;
  if (total > maxW) {
    const ratio = maxW / total;
    if (ratio >= MIN_COMPRESS_X) {
      sx = ratio;
    } else {
      sx = MIN_COMPRESS_X;
      k = ratio / MIN_COMPRESS_X;
    }
  }
  ctx.save();
  ctx.translate(anchorX, baseline);
  ctx.scale(sx * k, k);
  draw(align === 'center' ? -total / 2 : -total);
  ctx.restore();
}

/** #rrggbb を明るく（amount>0）または暗く（amount<0）する */
function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const channel = (v: number) =>
    Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const bl = channel(n & 255);
  return `rgb(${r}, ${g}, ${bl})`;
}

/** 描画に使う文字のフォントを読み込む（Web フォントは文字範囲ごとに遅延読込されるため） */
export function loadFontsFor(state: AppState): Promise<unknown> {
  if (!('fonts' in document)) return Promise.resolve();
  const text =
    state.subjects.map((s) => s.name + s.score + s.rank).join('') +
    state.note +
    '0123456789.-点位背景画像を選択してください';
  return Promise.all([
    document.fonts.load(tileFont(100), text),
    document.fonts.load(font(900, 100), text),
    document.fonts.load(font(700, 100), text),
  ]).catch(() => undefined);
}
