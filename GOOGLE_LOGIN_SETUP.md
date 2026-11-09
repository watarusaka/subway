# Googleログインとログイン状態の維持

このブランチはSupabaseの設定完了後に公開してください。設定がないとログインボタンが無効の「ログインの準備中」画面になります。公開中のmainは変更していません。

## 1. Supabase

1. https://supabase.com/dashboard でプロジェクトを作成します。データベースのパスワードは自分で管理し、チャットやコードに貼らないでください。
2. プロジェクトのConnect画面またはAPI設定からProject URLとPublishable keyを確認します。旧プロジェクトではanon/public keyも使用できます。Secret key・service_role keyはフロントエンドに絶対に設定しません。
3. Authentication → URL ConfigurationでSite URLを `https://subway-nu-coral.vercel.app`、Redirect URLsを `https://subway-nu-coral.vercel.app/` に設定します。ローカル確認用は `http://localhost:5173/` など実際に利用するURLを個別に追加してください。プレビューURLも必要なら個別に登録します。
4. Authentication → Providers（またはSign In / Providers）→ Googleの画面でコールバックURLを確認します。通常は `https://<project-ref>.supabase.co/auth/v1/callback` です。

## 2. Google Cloud

1. https://console.cloud.google.com/ でプロジェクトを作成または選択します。
2. Google Auth Platformの同意画面を設定します。個人のGoogleアカウントを使う場合は外部向けのTestingとして、テストユーザーに自分のメールアドレスだけを追加します。後日一般公開するときは公開状態とデータアクセス制御を改めて設定してください。
3. OAuth ClientをWeb applicationとして作成し、Authorized redirect URIsにSupabaseが示したコールバックURLを追加します。VercelのURLをGoogleのコールバックURLと取り違えないでください。
4. Client IDとClient secretをSupabaseのGoogleプロバイダー設定に登録し、有効にして保存します。GoogleのClient secretはSupabaseの管理画面だけに入力します。

## 3. Vercel

プロジェクトのSettings → Environment Variablesへ次を追加します。

- `VITE_SUPABASE_URL`: SupabaseのProject URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Publishable key（公開可能なキー）

Productionと、試す場合はPreviewに設定します。Viteはビルド時に値を取り込むため、変数を保存しただけでは反映されません。設定後にこのブランチをプレビューでデプロイするか、レビュー・マージ後に本番を再ビルドしてください。

## 仕様

- Supabase公式SDKのpersistSessionとautoRefreshTokenを有効にし、OAuthはPKCEで行います。Googleから戻ったあとセッションを保存し、再読み込み・ブラウザー再起動後に復元します。
- 起動時にSupabaseへユーザーを確認し、ログイン確認前に個人画面を表示しません。通信できないときはログイン確認の再試行が必要です。
- 設定 → アカウント → ログアウトでこのブラウザーのセッションを削除し、登録したサブスク情報は消しません。他のタブにもログアウトが反映されます。
- ブラウザーデータの削除、シークレットモード、認証サービス側でのセッション失効、GoogleのTesting状態などで再ログインが必要になることがあります。無期限の維持は保証しません。
- アカウントごとに異なるブラウザー内保存キーを使います。以前の `subnote-v1` は削除せず、設定から明示的に取り込めます。取り込みは現在のアカウントのデータを置き換えるので先にJSONバックアップを保存してください。
- 新規アカウントはサンプルを自動投入せず、空の状態から始めます。
- この段階ではGoogle認証のみです。Macとスマホ間のサブスク情報の同期・クラウドへのデータ保存は未実装です。ログインだけでは同じ情報になりません。

## 確認方法

実際のGoogle認証は上記サービスの設定後に実機で確認します。自動テストではGoogleやSupabaseに実ログインせず、認証APIをモックします。テスト用のSupabase URLとキーは実運用へ設定しないでください。

ブラウザーテストは `npx playwright test --workers=1` で、専用ポート5175とモック設定の開発サーバーを自動起動します。ローカルの実認証設定は不要です。Linux環境でChromeの代わりにシステムChromiumを使う場合は `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` を指定します。
