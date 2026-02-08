# 残課題・バックログ

このドキュメントでは、開発中に発見された未解決の課題やバグを記録します。

---

## 未解決の課題

### GIT-001: RAG用巨大ファイルはgit管理対象外

| 項目 | 内容 |
|------|------|
| 発見日 | 2025-12-28 |
| 優先度 | 高 |
| ステータス | 注意事項として記録 |

#### 概要

RAG（Retrieval-Augmented Generation）用の教科書PDFファイルはGitHubの100MBファイルサイズ制限を超えるため、git管理対象外とする。

#### 対象ファイル

- `data/all/*.pdf` - 教科書PDF（352MB等）
- `data/*.pdf` - その他の大容量PDF

#### .gitignoreの設定

```gitignore
# PDF files (copyright protected textbooks)
data/**/*.pdf
```

#### 注意事項

1. **新しいPDFを追加する際は `git add` しないこと**
2. 誤って `git add` した場合は `git rm --cached <file>` で除外
3. PDFファイルは著作権保護されたコンテンツのため、リポジトリには含めない
4. RAG処理に必要なPDFは各開発者がローカルで管理

#### 背景

2025-12-28にGitHub pushがHTTP 408タイムアウトで失敗。原因は`data/all/コンクリート診断士 _ 記述式全問題を掲載・解説 2024年版.pdf`（352MB）がコミットに含まれていたため。

---

### AUTH-001: 異なるOAuthプロバイダ間で学習履歴が共有されない

| 項目 | 内容 |
|------|------|
| 発見日 | 2025-12-30 |
| 優先度 | 低 |
| ステータス | 将来の改善事項 |

#### 問題の詳細

GitHubでログインした後にGoogleでログインすると、別ユーザーとして扱われ学習履歴が引き継がれない。

#### 現在の動作

- **GitHubでログイン** → Clerk上でGitHub用のユーザーIDが作成
- **Googleでログイン** → Clerk上でGoogle用の別ユーザーIDが作成
- 学習履歴はユーザーIDに紐づいているため、プロバイダが異なると履歴は共有されない

#### 将来的な解決策

1. **Clerkのアカウントリンク機能**
   - ユーザーが複数のOAuthプロバイダを1つのアカウントに紐付けられるようにする
   - 参考: https://clerk.com/docs/users/user-account-linking

2. **メールアドレスベースでのユーザー統合**
   - 同じメールアドレスで登録されている場合、同一ユーザーとして扱う
   - バックエンドでメールアドレスをキーにユーザーを照合

3. **ユーザーへの注意喚起**
   - ログイン画面で「同じプロバイダでログインしてください」と案内

#### 現状の対応

現時点では対応不要。ユーザー数が増えて要望が出た場合に検討。

---

## 解決済みの課題

### ASC-001: iPad用スクリーンショットによるApp Store審査リジェクト

| 項目 | 内容 |
|------|------|
| 発見日 | 2026-01-07 |
| 解決日 | 2026-01-07 |
| 対象 | App Store審査 (Guideline 2.3.3) |
| ステータス | 解決済み |

#### 問題の詳細

App Store審査で「Guideline 2.3.3 - Performance - Accurate Metadata」によりリジェクト。iPadスクリーンショットがiPhone画像を加工・引き伸ばしたものと判断された。

> "The 13-inch iPad screenshots show an iPhone image that has been modified or stretched to appear to be an iPad image."

#### 原因

- `app.json` で `"supportsTablet": true` が設定されていた
- iPad実機/シミュレーターでスクリーンショットを撮らず、iPhone画像をリサイズして提出した
- Appleの審査基準では、各デバイス用のスクリーンショットは実際のデバイス画面を反映する必要がある

#### 解決策

1. `app.json` を編集: `"supportsTablet": false` に変更
2. EASでリビルド
3. App Store ConnectからiPadスクリーンショットを削除
4. 再審査に提出

#### 教訓・再発防止策

1. **MVPフェーズではiPad対応を無効にする**
   - `app.json` で `"supportsTablet": false` を最初から設定
   - iPad対応は実機でのテストとスクリーンショット撮影が可能になってから

2. **App Store スクリーンショットのルール**
   - iPhone画像をiPad用にリサイズしてはいけない
   - 各デバイス用のスクリーンショットは実際のデバイス画面を反映
   - iPad対応する場合は、iPad実機またはシミュレーターでスクリーンショットを撮影

3. **新規プロジェクト作成時のチェックリスト**
   ```json
   // app.json - MVPフェーズ
   "ios": {
     "supportsTablet": false,  // iPad対応しない場合はfalse
     ...
   }
   ```

4. **iPad対応を追加する場合の手順**
   - macOS + Xcodeでシミュレーターを起動
   - アプリをiPadシミュレーターで実行
   - 各画面のスクリーンショットを撮影（2048 x 2732 px）
   - その後 `"supportsTablet": true` に変更してビルド

---

### IAP-001: RevenueCat初期化エラー「課金システムの初期化に失敗しました」

| 項目 | 内容 |
|------|------|
| 発見日 | 2026-01-03 |
| 解決日 | 2026-01-03 |
| 対象 | RevenueCatダッシュボード設定 |
| ステータス | 解決済み |

#### 問題の詳細

TestFlightでアプリを起動後、プラン画面に「課金システムの初期化に失敗しました」というエラーが表示される。

#### 原因

複数の設定ミスが重なっていた：

1. **Entitlement IDの不一致**
   - コード側: `pro_access`
   - RevenueCatダッシュボード: `pro`

2. **RevenueCat Offeringsに商品が未設定**
   - `default` オファリングは存在したが、Packageに商品（Product）が追加されていなかった
   - Product ID `com.banquetkuma.concretediagnostician.monthly` が未設定

#### 解決策

1. **コード修正** (`hooks/useRevenueCat.ts`):
   ```typescript
   // Before
   const ENTITLEMENT_ID = 'pro_access';

   // After
   const ENTITLEMENT_ID = 'pro';
   ```

2. **RevenueCatダッシュボード設定**:
   - Products → App Store Connectの商品IDを追加
   - Offerings → `default` オファリングの `Monthly` パッケージに商品を紐付け

#### 教訓・再発防止策

1. **RevenueCat設定チェックリスト**
   - [ ] Apps: Bundle IDがXcode/app.jsonと一致しているか
   - [ ] Products: App Store Connectの商品IDが登録されているか
   - [ ] Offerings: `default` オファリングが存在し、Packageに商品が追加されているか
   - [ ] Entitlements: IDがコードの `ENTITLEMENT_ID` と一致しているか

2. **EAS Secrets設定**
   - [ ] `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` が登録されているか（`eas secret:list` で確認）
   - [ ] APIキーがRevenueCatダッシュボードの値と一致しているか

3. **デバッグ時の確認順序**
   ```
   1. EAS Secrets → 環境変数が設定されているか
   2. RevenueCat Apps → Bundle IDが正しいか
   3. RevenueCat Products → 商品が登録されているか
   4. RevenueCat Offerings → 商品がオファリングに追加されているか
   5. コード → ENTITLEMENT_IDが一致しているか
   ```

4. **よくあるエラーと原因**

   | エラー | 原因 |
   |--------|------|
   | 「課金システムの初期化に失敗しました」 | Offerings未設定、APIキー未設定、商品未追加 |
   | 「RevenueCat APIキーが設定されていません」 | EAS Secretsに環境変数が未登録 |
   | Proメンバーと認識されない | Entitlement IDの不一致 |

---

### UI-005: 統計タブのアイコンが表示されない

| 項目 | 内容 |
|------|------|
| 発見日 | 2025-12-30 |
| 解決日 | 2025-12-30 |
| 対象ファイル | `components/ui/IconSymbol.tsx` |
| ステータス | 解決済み |

#### 問題の詳細

タブバーの「統計」タブにアイコンが表示されない。「ホーム」タブは家のアイコンが表示されているが、「統計」タブはラベルのみでアイコンが見えない状態。

#### 原因

`IconSymbol`コンポーネントは、SF Symbols（iOS）の名前をMaterial Icons（Android/Web）にマッピングする仕組みを使用している。

```tsx
// components/ui/IconSymbol.tsx
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  // 'chart.bar.fill' が定義されていなかった！
} as IconMapping;
```

`_layout.tsx`では`chart.bar.fill`を使用していたが、`MAPPING`に定義がなかったため、`undefined`が返りアイコンが表示されなかった。

#### 解決策

`IconSymbol.tsx`の`MAPPING`に`chart.bar.fill`のマッピングを追加：

```tsx
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chart.bar.fill': 'bar-chart',  // 追加
} as IconMapping;
```

#### 教訓・再発防止策

1. **新しいアイコンを使用する前に`IconSymbol.tsx`のMAPPINGを確認する**
   - SF Symbolsの名前をそのまま使っても、Web/Androidでは動作しない
   - 必ずMaterial Iconsへのマッピングを追加する必要がある

2. **アイコン追加時のチェックリスト**
   - [ ] 使用するSF Symbol名を確認
   - [ ] `components/ui/IconSymbol.tsx`の`MAPPING`に定義があるか確認
   - [ ] なければ、Material Iconsの対応アイコンを探して追加
   - [ ] Material Iconsの検索: https://icons.expo.fyi

3. **コードレビュー時の注意点**
   - `IconSymbol`コンポーネントに新しい`name`を渡している場合、`MAPPING`への追加を確認

4. **将来の改善案**
   - TypeScriptの型定義を厳格にして、未定義のアイコン名を使用するとコンパイルエラーになるようにする
   - 開発時に未マッピングのアイコンを使用した場合、コンソールに警告を出す

---

### UI-001: 解説文の段落間隔が表示されない

| 項目 | 内容 |
|------|------|
| 発見日 | 2025-12-27 |
| 解決日 | 2025-12-27 |
| 対象ファイル | `app/questions/[year]/[questionId].tsx` |
| ステータス | 解決済み |

#### 問題の詳細

問題詳細画面の解説セクションにおいて、`[正解]` と `[誤り]` の間に空白行が表示されず、テキストが詰まって読みにくい状態になっている。

#### 原因

1. **文字エンコーディングの不一致**: UIコードでは半角括弧 `[正解]` を想定していたが、実データは全角括弧 `【正解】` を使用していた
2. **スタイル適用方法の問題**: `style={[styles.text, condition && styles.margin]}` の形式ではmarginTopが適用されなかった

#### 解決策

1. **正規表現を全角対応に修正**: `/(?=【正解】|【誤り】|\[正解\]|\[誤り\])/`
2. **ThemedViewでラップしてインラインスタイル適用**:
   ```tsx
   <ThemedView style={index > 0 ? { marginTop: 20 } : undefined}>
     <ThemedText>{content}</ThemedText>
   </ThemedView>
   ```

#### 教訓

**画面表示からの推測ではなく、APIの実データを確認することが最重要**。詳細は `.claude/skills/ui-debug/SKILL.md` に記録。

### UI-002: 問題一覧の分野表記が大きすぎる

| 項目 | 内容 |
|------|------|
| 発見日 | 2025-12-27 |
| 解決日 | 2025-12-27 |
| 対象ファイル | `app/questions/[year].tsx` |
| ステータス | 解決済み |

#### 対応内容

`categoryText` の `fontSize` を 28 から 14 に変更。

---

### UI-003: ホーム・統計ページの下部コンテンツが見切れる

| 項目 | 内容 |
|------|------|
| 発見日 | 2025-12-27 |
| 解決日 | 2025-12-27 |
| 対象ファイル | `app/(tabs)/index.tsx`, `app/(tabs)/stats.tsx` |
| ステータス | 解決済み |

#### 問題の詳細

ホームページと統計ページで、スクロールを最下部まで行っても一番下のコンテンツがタブバーに隠れて見切れる。

#### 原因

`SafeAreaView` に `edges={['top']}` のみ指定されており、下部のセーフエリア（タブバー分）が考慮されていなかった。

#### 解決策

両ページの `content` スタイルに `paddingBottom: 100` を追加:

```tsx
// app/(tabs)/index.tsx
content: {
  padding: 20,
  paddingBottom: 100,  // 追加
  gap: 20,
},

// app/(tabs)/stats.tsx
content: {
  padding: 20,
  paddingBottom: 100,  // 追加
},
```

#### 教訓

タブナビゲーションを使用する画面では、下部にタブバー分の余白を確保する必要がある。`paddingBottom: 40` では不十分で、`100` 程度が適切。

---

### UI-004: 問題文の左側に不要な青い線がある

| 項目 | 内容 |
|------|------|
| 発見日 | 2025-12-27 |
| 解決日 | 2025-12-27 |
| 対象ファイル | `app/questions/[year]/[questionId].tsx` |
| ステータス | 解決済み |

#### 対応内容

`questionContainer` スタイルから `borderLeftWidth` と `borderLeftColor` を削除。

---

## 課題の追加方法

新しい課題を発見した場合は、以下のテンプレートを使用して追加してください：

```markdown
### カテゴリ-番号: 課題タイトル

| 項目 | 内容 |
|------|------|
| 発見日 | YYYY-MM-DD |
| 優先度 | 高/中/低 |
| 対象ファイル | `path/to/file` |
| ステータス | 未解決/調査中/解決済み |

#### 問題の詳細

（問題の説明）

#### 期待される動作

（どうあるべきか）

#### 試行した対策

（試した解決策とその結果）
```

---

## 優先度の定義

| 優先度 | 説明 |
|--------|------|
| 高 | アプリの主要機能に影響、クラッシュを引き起こす、リリースブロッカー |
| 中 | UX に影響するが回避策がある、見た目の問題 |
| 低 | 軽微な問題、将来の改善事項 |
