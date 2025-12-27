# Task 011: Apple Developer Program 登録

## 基本情報

| 項目 | 内容 |
|------|------|
| Phase | 6 - Apple Developer Program |
| 工数 | 30分 + 承認待ち24-48時間 |
| 依存タスク | task010 |
| 成果物 | 開発者アカウント、証明書 |
| 費用 | ¥12,980/年 |

---

## 目的

Apple Developer Program に登録し、App Store へアプリを公開するために必要な証明書・プロファイルを準備する。

---

## 📚 学習ポイント：Apple Developer Program の基礎

### なぜ有料プログラムが必要か？

```
【Apple Developer Program なしでできること】
✅ Xcode でアプリを開発
✅ シミュレーターでテスト
✅ 自分のデバイス1台にインストール（7日間限定）

【Apple Developer Program ありでできること】
✅ 上記すべて
✅ App Store に公開
✅ TestFlight でベータ配信
✅ 無制限のテストデバイス
✅ プッシュ通知などの高度な機能
✅ App Store Connect（分析、売上管理）
```

### 個人と組織の違い

```
【個人 (Individual)】
- 費用: ¥12,980/年
- 必要なもの: 本人確認のみ
- App Store の表示名: 個人名またはニックネーム
- 適している場合: 個人開発者、趣味の開発

【組織 (Organization)】
- 費用: ¥12,980/年
- 必要なもの: DUNS番号（会社の識別番号）
- App Store の表示名: 会社名
- 適している場合: 法人、チーム開発

※ DUNS番号の取得には2週間程度かかる場合があります
```

### コード署名の仕組み

```
【なぜコード署名が必要？】

1. アプリの出所を保証
   「このアプリは確かに○○さんが作った」

2. 改ざんの検知
   「ダウンロード後に誰かが変更していない」

3. Appleが信頼
   「Apple Developer Program に参加している開発者」

【署名の流れ】
開発者 → 証明書で署名 → App Store → ユーザー
                 ↑
          「この署名は有効」とAppleが確認
```

---

## 6.1 Apple Developer Program 登録

### 事前準備

| 項目 | 状態 |
|------|------|
| Apple ID を持っている | [ ] |
| 2ファクタ認証が有効 | [ ] |
| 有効なクレジットカード | [ ] |
| 本人確認書類（個人の場合） | [ ] |

### 登録手順

1. **Apple Developer ページにアクセス**
   - https://developer.apple.com/programs/

2. **「Enroll」をクリック**

3. **アカウントタイプを選択**
   - **個人 (Individual)**: 個人開発者向け
   - **組織 (Organization)**: 法人向け（DUNS番号必要）

4. **Apple ID でサインイン**

5. **個人情報入力**
   - 名前（ローマ字）
   - 住所
   - 電話番号

6. **契約に同意**

7. **支払い**
   - ¥12,980/年（自動更新）

8. **承認待ち**
   - 通常24-48時間

### 登録完了確認

```
https://developer.apple.com/account
```

にアクセスして、メンバーシップ情報が表示されることを確認。

---

## 📚 学習ポイント：EAS（Expo Application Services）とは

### EAS を使うメリット

```
【従来のiOSアプリ開発】
1. Mac を用意する（必須）
2. Xcode をインストール
3. 証明書を手動で作成
4. プロビジョニングプロファイルを作成
5. ローカルでビルド
6. 手動で App Store にアップロード

❌ 複雑、Mac必須、時間がかかる

【EAS を使った開発】
1. eas build コマンドを実行
2. Expo のクラウドでビルド
3. 証明書は自動管理
4. ワンコマンドでApp Storeに提出

✅ シンプル、Mac不要、自動化
```

### EAS の主なサービス

```
【EAS Build】
- クラウド上でアプリをビルド
- iOS、Android両方に対応
- Mac がなくてもiOSアプリを作れる

【EAS Submit】
- App Store / Google Play への自動提出
- メタデータの管理

【EAS Update】
- OTA（Over-The-Air）アップデート
- 審査なしでJSコードを更新可能
```

---

## 6.2 EAS CLI セットアップ

### インストール

```bash
npm install -g eas-cli
```

### ログイン

```bash
eas login
# Expo アカウントでログイン
```

### プロジェクト連携

```bash
cd /mnt/c/dev/IOS_App_Dev/concrete_diagnostician

# EAS プロジェクト初期化
eas init

# Apple Developer アカウント連携
eas credentials
```

---

## 6.3 証明書・プロファイル作成

## 📚 学習ポイント：証明書とプロファイルの関係

### iOS コード署名の全体像

```
【登場人物】

1. App ID（アプリの住所）
   - Bundle ID: com.yourcompany.appname
   - 「このアプリは何者か？」を識別

2. Certificate（証明書 = 身分証明書）
   - 「この開発者は本人である」を証明
   - 公開鍵暗号方式を使用

3. Provisioning Profile（許可証）
   - 「このApp IDに、この証明書で署名したアプリを
     このデバイスで実行してよい」という許可証
   - App ID + Certificate + デバイスリスト の組み合わせ

【関係図】
┌─────────────────────────────────────────┐
│         Provisioning Profile            │
│ ┌─────────┐ ┌─────────┐ ┌───────────┐ │
│ │ App ID  │ │証明書    │ │デバイス一覧│ │
│ └─────────┘ └─────────┘ └───────────┘ │
└─────────────────────────────────────────┘
              ↓ これを使って
┌─────────────────────────────────────────┐
│         アプリに署名                     │
└─────────────────────────────────────────┘
              ↓
          App Store or デバイス
```

### 証明書の種類

```
【Development Certificate】開発用
- 開発中のテスト用
- デバッグビルド用

【Distribution Certificate】配布用
- App Store 提出用
- TestFlight 配布用
- アカウントにつき2つまで

【違いのイメージ】
開発証明書 = 「試作品を見せてもいいよ」
配布証明書 = 「正式に世に出していいよ」
```

### Bundle ID の命名規則

```
【推奨フォーマット】
com.会社名.アプリ名

例:
com.apple.mobilesafari      (Apple の Safari)
com.google.maps             (Google Maps)
com.yourname.concrete-app   (あなたのアプリ)

【注意点】
- 全世界でユニークである必要がある
- 一度決めたら変更できない（新アプリ扱いになる）
- 小文字、数字、ハイフン、ピリオドのみ使用可能
```

### EAS を使った自動作成（推奨）

```bash
# iOS 証明書を自動作成
eas credentials --platform ios

# 以下を選択:
# 1. Set up signing credentials
# 2. Production certificate → Create new
# 3. Provisioning profile → Create new
```

### 手動作成の場合

#### App ID 登録

1. [Apple Developer Console](https://developer.apple.com/account/resources/identifiers/list) にアクセス
2. Identifiers → + ボタン
3. App IDs → Continue
4. App → Continue
5. 以下を入力:
   - Description: `Concrete Diagnostician`
   - Bundle ID: `com.yourcompany.concrete-diagnostician`
6. Capabilities は必要に応じて選択
7. Register

#### 証明書作成

1. Certificates → + ボタン
2. **Apple Distribution** を選択
3. CSR（Certificate Signing Request）をアップロード
   ```bash
   # Mac で CSR 作成
   openssl genrsa -out private_key.key 2048
   openssl req -new -key private_key.key -out certificate.csr
   ```
4. 証明書をダウンロード

#### Provisioning Profile 作成

1. Profiles → + ボタン
2. **App Store Connect** を選択
3. App ID を選択
4. 証明書を選択
5. プロファイル名を入力
6. Generate → Download

---

## 6.4 EAS Build 設定

### eas.json 作成

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890"
      }
    }
  }
}
```

### app.json 更新

```json
{
  "expo": {
    "name": "コンクリート診断士試験対策",
    "slug": "concrete-diagnostician",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.yourcompany.concrete-diagnostician",
      "buildNumber": "1",
      "supportsTablet": true
    }
  }
}
```

---

## 6.5 チェックリスト

### Apple Developer 登録

- [ ] Apple Developer Program 登録申請
- [ ] 支払い完了
- [ ] 承認完了（メンバーシップ有効）

### EAS セットアップ

- [ ] eas-cli インストール
- [ ] eas login 完了
- [ ] eas init 完了

### 証明書・プロファイル

- [ ] App ID 登録完了
- [ ] Distribution Certificate 作成完了
- [ ] App Store Provisioning Profile 作成完了

### プロジェクト設定

- [ ] eas.json 作成
- [ ] app.json に bundleIdentifier 設定
- [ ] eas credentials で設定確認

---

## 注意事項

### 費用について

- Apple Developer Program: **¥12,980/年**（自動更新）
- 更新しないとアプリが App Store から削除される

### 証明書の有効期限

- Distribution Certificate: **1年**
- Provisioning Profile: **1年**
- 期限切れ前に更新が必要

### EAS Build の無料枠

- 月30ビルドまで無料
- 有料プランで追加可能

---

## トラブルシューティング

### 登録が承認されない

- 本人確認書類の再提出が求められることがある
- Apple サポートに連絡

### 証明書エラー

```bash
# 証明書をリセット
eas credentials --platform ios
# "Remove existing credentials" を選択
```

### Bundle ID の重複

- 既に使用されている Bundle ID は使えない
- ユニークな ID を設定する

---

## 次のタスク

→ [task012-app-store-preparation.md](./task012-app-store-preparation.md)
