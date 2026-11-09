# subwayをVercelで公開する

## 公開するアプリ

リポジトリのルートにあるVite製Web版を公開します。`mobile/` は以前作成したExpo版で、VercelのRoot Directoryには指定しません。Web版は画面幅で表示を切り替え、700px以下の縦画面に `src/mobile.css` を適用します。PC・横画面は既存のレイアウトです。HTML・JavaScript・CSSを別形式に変換する必要はありません。

## GitHub経由（推奨）

1. この変更をGitHubのmainブランチへマージします。
2. https://vercel.com/new を開き、GitHubの `watarusaka/subway` をImportします。
3. Framework PresetはVite、Root Directoryはルート（空欄または `./`）を選びます。
4. Install Commandは `npm ci`、Build Commandは `npm run build`、Output Directoryは `dist` です。`vercel.json`にも保存済みです。
5. GOOGLE_LOGIN_SETUP.mdに従ってSupabase・Googleを設定し、VITE_SUPABASE_URLとVITE_SUPABASE_PUBLISHABLE_KEYを登録します。設定後にDeployを押し、発行されたHTTPSのURLをスマホとPCで開きます。
6. 更新はGitHubへ反映すると自動でビルド・公開されます。main以外のブランチは通常プレビューになります。

既存の別アプリのVercelプロジェクトは変更せず、subway用の新しいプロジェクトを作成してください。

## Macから直接公開する方法

Web版の `package.json` と `vercel.json` があるリポジトリルートで `npm ci`、`npm run build` を実行します。
`npx vercel` でログインし、新しいプロジェクトとしてプレビューデプロイできます。確認後 `npx vercel --prod` で本番公開します。`mobile/` 内から実行しないでください。

## データとログイン

VercelはWebサイトの公開先です。現状はブラウザーのlocalStorageに保存し、Googleログインには別途Supabaseの接続設定が必要で、Mac/スマホ間のデータ同期は未実装です。同じURLでも端末間で自動共有されません。
Macの既存アプリの「設定・データ管理」からJSONバックアップを保存して、公開先で復元できます。localhostと公開URLの保存領域は別です。
Googleログインの設定はGOOGLE_LOGIN_SETUP.mdを参照してください。同期は別途データベースと利用者ごとのアクセス制御が必要です。設定がないビルドはログイン準備中の画面になるため、設定前に本番へ反映しないでください。

## 確認

`npm test`、`npm run build`。ブラウザーテストは開発サーバーを起動して `npx playwright test`（Chromeが必要）で実行できます。
スマホは追加・編集・通知・月移動・設定、PCは従来のレイアウトを確認してください。スマホのホーム画面追加用アイコンも設定済みです。
