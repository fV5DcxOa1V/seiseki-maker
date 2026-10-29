// アプリ全体の設定値。色・初期値・レイアウト寸法はここで一元管理する。

export const CANVAS_WIDTH = 1600;
export const CANVAS_HEIGHT = 900;
export const OUTPUT_FILENAME = 'seiseki-maker.png';
export const STORAGE_KEY = 'seiseki-maker:v1';

/** 注記などに使うゴシック体 */
export const FONT_FAMILY =
  '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif';

/** 成績タイルに使う明朝体（極太） */
export const TILE_FONT_FAMILY =
  '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", serif';

/** タイルの基本色。将来カラーピッカーで上書きできるよう Subject.color に値として保持する */
export const TILE_COLORS = {
  blue: '#1b4da6',
  purple: '#5d2a8f',
  red: '#be1e2d',
  gold: '#b8860b',
  brightGold: '#c99a16',
  green: '#1c7a3c',
} as const;

export interface SubjectPreset {
  name: string;
  color: string;
}

/** 公認会計士試験プリセット。将来は試験ごとにプリセットを切り替えられる */
export const DEFAULT_SUBJECTS: SubjectPreset[] = [
  { name: '監査論', color: TILE_COLORS.blue },
  { name: '租税法', color: TILE_COLORS.purple },
  { name: '会計学', color: TILE_COLORS.red },
  { name: '企業法', color: TILE_COLORS.gold },
  { name: '経営学', color: TILE_COLORS.green },
  { name: '総合', color: TILE_COLORS.brightGold },
];

export const DEFAULT_TEXT = {
  examName: '会計士試験',
  note: '※合格ラインは平均52点',
};

/** 共有テキストに付けるハッシュタグ（固定） */
export const SHARE_HASHTAG = '#成績発表メーカー';

export const BACKGROUND_ZOOM = { min: 1, max: 3 };

/** Canvas 上のレイアウト（すべて 1600×900 座標系の px。タイル内の y はタイル上端から） */
export const LAYOUT = {
  marginX: 18,
  marginBottom: 24,
  /** 注記がある場合のタイル下の余白（注記を置くスペース） */
  marginBottomWithNote: 42,
  tileGap: 12,
  tileHeight: 296,
  tileBorder: 5,
  tilePaddingX: 8,

  nameCenterY: 50,
  nameFontSize: 68,

  /** 点数：整数部を大きく、右側に小数部（上段）と「点」（下段）を縦に積む */
  scoreFontSize: 138,
  scoreBaselineY: 196,
  scoreFontSizeNoRank: 150,
  scoreBaselineYNoRank: 238,
  scoreDecimalRatio: 0.34,
  scoreUnitRatio: 0.3,
  /** 小数部のベースラインを整数部のベースラインから上げる量（整数部サイズ比） */
  scoreDecimalRise: 0.4,
  scoreColumnGap: 0.05,

  separatorY: 214,
  separatorInset: 12,
  separatorWidth: 3,

  /** 順位：数字と「位」の間をあけて右寄せ */
  rankBaselineY: 276,
  rankFontSize: 60,
  rankUnitFontSize: 42,
  rankUnitGap: 26,
  rankPaddingRight: 10,

  noteFontSize: 30,
  /** 注記のベースライン（画像下端からの距離） */
  noteBaselineFromBottom: 10,
};
