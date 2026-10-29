# 成績発表メーカー

試験結果を画像にしてシェアできるサービス。背景写真と成績タイルを合成した 1600×900 の PNG を作成・保存・共有できます。

## 開発

```sh
npm install
npm run dev      # 開発サーバー
npm run build    # 型チェック + dist/ へビルド
npm run preview  # ビルド結果の確認
```

## 公開（GitHub Pages）

`main` へ push すると `.github/workflows/deploy.yml` がビルドして公開します。
初回のみリポジトリの Settings → Pages → Source を「GitHub Actions」に設定してください。

公開 URL は `.env` の `VITE_SITE_URL` で管理しています（OGP 画像の絶対 URL・X 投稿文の URL に使用）。
独自ドメインなどに変える場合はここを書き換えてください。リンクカード画像は `public/ogp.png`（1200×630）です。

## 構成

| ファイル | 役割 |
| --- | --- |
| `src/config.ts` | 色・初期科目・初期文言・Canvas レイアウト寸法 |
| `src/state.ts` | データ構造（科目配列など）と Store |
| `src/renderer.ts` | Canvas 描画（プレビューと PNG 出力で共通） |
| `src/form.ts` | 入力フォームと Store の同期、バリデーション表示 |
| `src/validation.ts` | 点数・順位の検証と表示用整形 |
| `src/storage.ts` | localStorage への自動保存・復元 |
| `src/exporter.ts` | PNG 生成・ダウンロード |
| `src/share.ts` | Web Share API と X 投稿画面へのフォールバック |
| `src/main.ts` | 各モジュールの組み立て |

科目は `Subject { id, name, score, rank, color, visible }` の配列で管理しています。
科目追加・並び替え・色変更は、この配列を操作する UI を追加すれば対応できます。
