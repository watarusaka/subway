# subway / Expo テスト版

既存Web版とは別のReact Nativeアプリです。Expo SDK 58に対応するExpo Goを使用してください。

## Macで起動

このフォルダーで `npm ci`、続けて `npx expo start --lan` を実行します。
Macとスマホを同じWi-Fiに接続し、Expo Goで表示されたQRコードを読み取ります。
iPhoneはカメラからQRコードを開けます。SDKの不一致が表示された場合はExpo Goを更新してください。
Expo Go内で開く間、端末ホーム画面のExpo Go自体のアイコンは変わりません。subwayのアプリアイコンは開発ビルド・配布ビルドで反映されます。

## 実装済み

カレンダーと日別支払い、サブスク追加・編集・削除、月払い・年払い、月額換算、一時停止・再開・利用終了、端末内保存。提供画像をアプリ内ロゴとアプリアイコンに使用。

## 未実装

Googleログイン、クラウド同期、Web版データの取り込み、解約通知、詳細レポート。Web版の全機能を移植済みではありません。
GoogleログインはSupabase OAuth + PKCEと `subway://` コールバックを使用する構成を予定。Expo Goではなく開発ビルドで認証を検証します。SupabaseとGoogleのプロジェクト設定が必要です。最初はサーバー側で本人だけを許可し、将来公開するときも利用者別のアクセス制御を維持します。秘密鍵をアプリへ埋め込まないでください。

## 検証

`npx tsc --noEmit`
`EXPO_OFFLINE=1 npx expo export --platform ios --platform android`

エクスポートはJavaScriptバンドルの検証であり、実機テストやストア配布ビルドではありません。
