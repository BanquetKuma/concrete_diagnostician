# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Native mobile application built with Expo SDK 53 and TypeScript. The app uses Expo Router for file-based navigation and supports iOS, Android, and Web platforms.

## Build/Development Commands

### Running the Application

- Start development server: `npm start` or `npx expo start`
- Run on iOS: `npm run ios`
- Run on Android: `npm run android`
- Run on Web: `npm run web`
- Install dependencies: `npm install`

### Code Quality

- Lint: `npm run lint`
- Type check: TypeScript checks run automatically with strict mode enabled

### Other Commands

- Reset project: `npm run reset-project` (removes boilerplate and resets to fresh state)

## Project Structure

### Key Directories

- `/app`: File-based routing with Expo Router
  - `(tabs)/`: Tab navigation screens
  - `_layout.tsx`: Layout components
  - Routes automatically generated from file structure
- `/components`: Reusable React components
  - Themed components for consistent styling
  - Platform-specific UI components in `/ui`
- `/assets`: Images, fonts, and other static resources
- `/constants`: App-wide constants like Colors
- `/hooks`: Custom React hooks, primarily for theming

### Navigation Pattern

The app uses Expo Router's file-based routing:

- Files in `/app` automatically become routes
- `_layout.tsx` files define layout wrappers
- `(tabs)` group creates tab navigation
- Dynamic routes use `[param].tsx` naming

## Code Style Guidelines

### TypeScript/React Native

- Use functional components with TypeScript
- Props interfaces should be defined for all components
- Use `StyleSheet.create()` for styles, not inline styles
- Import React types from 'react' (e.g., `import { FC, ReactNode } from 'react'`)
- Use absolute imports with `@/` prefix (configured in tsconfig)

### Component Structure

```typescript
import { StyleSheet } from 'react-native';
import { ThemedView, ThemedText } from '@/components/themed';

interface ComponentProps {
  // Define props
}

export function ComponentName({ prop }: ComponentProps) {
  // Component logic
  return (
    <ThemedView style={styles.container}>
      {/* Component JSX */}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    // Styles
  }
});
```

### Theming

- Use `ThemedText` and `ThemedView` components for automatic dark/light mode support
- Access colors via `Colors[colorScheme]` pattern
- Use `useColorScheme()` hook for theme-aware components

### Platform-Specific Code

- Use `.ios.tsx` and `.android.tsx` file extensions for platform-specific components
- Use `Platform.select()` for small platform differences
- Wrap platform-specific imports in conditional checks

---

## Clean Architecture 方針

本プロジェクトはクリーンアーキテクチャの原則に従って実装する。

### レイヤー構成

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  (UI Components, Screens, Hooks)                            │
│  app/, components/                                          │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                         │
│  (Use Cases, Application Services)                          │
│  lib/usecases/, hooks/                                      │
├─────────────────────────────────────────────────────────────┤
│                      Domain Layer                            │
│  (Entities, Business Rules, Interfaces)                     │
│  lib/domain/                                                │
├─────────────────────────────────────────────────────────────┤
│                  Infrastructure Layer                        │
│  (API Client, DB, External Services)                        │
│  lib/infrastructure/, workers/                              │
└─────────────────────────────────────────────────────────────┘
```

### 依存関係のルール

- **内側から外側への依存禁止**: Domain層はInfrastructure層を直接参照しない
- **依存性の逆転**: インターフェースをDomain層に定義し、Infrastructure層で実装
- **単方向の依存**: Presentation → Application → Domain ← Infrastructure

### フロントエンド (Expo/React Native)

```
lib/
├── domain/              # ドメイン層
│   ├── entities/        # エンティティ（Question, User, Answer）
│   ├── repositories/    # リポジトリインターフェース
│   └── services/        # ドメインサービス
├── usecases/            # アプリケーション層
│   ├── questions/       # 問題取得ユースケース
│   ├── answers/         # 解答保存ユースケース
│   └── progress/        # 進捗管理ユースケース
└── infrastructure/      # インフラ層
    ├── api/             # APIクライアント
    ├── storage/         # ローカルストレージ
    └── repositories/    # リポジトリ実装
```

### バックエンド (Cloudflare Workers)

```
workers/src/
├── domain/              # ドメイン層
│   ├── entities/        # エンティティ
│   └── repositories/    # リポジトリインターフェース
├── usecases/            # アプリケーション層
│   └── questions/       # 問題関連ユースケース
├── infrastructure/      # インフラ層
│   ├── db/              # Turso DB接続
│   └── repositories/    # リポジトリ実装
└── routes/              # プレゼンテーション層（APIルート）
```

### 実装ガイドライン

1. **エンティティ**: ビジネスロジックを持つ純粋なTypeScriptクラス/型
   ```typescript
   // lib/domain/entities/Question.ts
   export interface Question {
     id: string;
     year: number;
     text: string;
     choices: Choice[];
     correctChoiceId: string;
   }
   ```

2. **リポジトリインターフェース**: Domain層で定義
   ```typescript
   // lib/domain/repositories/IQuestionRepository.ts
   export interface IQuestionRepository {
     getByYear(year: number): Promise<Question[]>;
     getById(id: string): Promise<Question | null>;
   }
   ```

3. **ユースケース**: アプリケーション固有のビジネスロジック
   ```typescript
   // lib/usecases/questions/GetQuestionsByYear.ts
   export class GetQuestionsByYear {
     constructor(private questionRepo: IQuestionRepository) {}
     async execute(year: number): Promise<Question[]> {
       return this.questionRepo.getByYear(year);
     }
   }
   ```

4. **リポジトリ実装**: Infrastructure層でAPIを呼び出す
   ```typescript
   // lib/infrastructure/repositories/QuestionRepository.ts
   export class QuestionRepository implements IQuestionRepository {
     async getByYear(year: number): Promise<Question[]> {
       const response = await fetch(`/api/questions/${year}`);
       return response.json();
     }
   }
   ```

### MVPでの簡略化

MVPフェーズでは完全なクリーンアーキテクチャを厳密に適用せず、以下を優先:

- **types/**: 型定義を集約（entities相当）
- **hooks/**: データ取得ロジックをカスタムフックで抽象化（usecases相当）
- **lib/api/**: APIクライアント（infrastructure相当）

将来のスケール時にリファクタリングしやすい構造を維持する。

---

## Development Tips

### Expo Router

- Routes are automatically typed via `expo-router/typed-routes`
- Use `<Link>` component for navigation
- Access route params with `useLocalSearchParams()`
- Use `Stack` or `Tabs` from `expo-router` for navigation

### Asset Management

- Import images directly: `import image from '@/assets/images/...'`
- Use `expo-font` for custom fonts
- Assets are automatically optimized by Expo

### Environment Setup

- Expo Go app for quick testing on physical devices
- Use development builds for native modules
- Web support requires no additional setup

### Mobile Testing Setup (Windows)

- **Development Environment**: Use WSL2 for main development
- **Mobile Testing**: **Must use Windows PowerShell** (not WSL2) for device testing
  - WSL2 has network isolation issues preventing mobile device access
  - Windows PowerShell provides direct network access for QR code scanning
  ```powershell
  # Windows PowerShell (Required for mobile testing)
  cd C:\Users\banqu\IOS_App_Dev\concrete_diagnostician
  npx expo start
  ```
- **Why Windows PowerShell is Required**:
  - WSL2 runs in virtual network that mobile devices cannot reach
  - Windows PowerShell uses native Windows networking
  - Same codebase accessible from both environments via shared filesystem
- **Security Settings for Mobile Testing**:
  - **Disable Norton 360 Auto-Protect** temporarily during testing
  - **Disable Windows Firewall** or add exception for ports 8081-8082
  - **Network Requirements**: Ensure PC and mobile device are on same WiFi network
  - **Re-enable Security** after testing session

### GitHub Codespaces開発（リモート環境）

外出先や実家など、ローカル開発環境がない場所からでもGitHub Codespacesを使用して開発・テストが可能。

- **Codespaceの起動**:
  1. GitHubリポジトリで「Code」→「Codespaces」→「Create codespace on main」
  2. コンテナが起動するまで待機（初回は数分かかる）

- **Expoアプリの起動**:
  ```bash
  # トンネルモードで起動（必須）
  npm run start:tunnel
  # または
  npm run start:codespaces
  ```

- **モバイル端末での接続**:
  1. ターミナルに表示されるQRコードをExpo Goアプリでスキャン
  2. ngrokトンネル経由でアプリが起動

- **なぜトンネルモードが必要か**:
  - GitHub Codespacesはクラウド上の隔離環境で動作
  - ローカルネットワーク経由での接続は不可
  - `--tunnel`オプションでngrok公開URLを生成し、どこからでも接続可能に

- **Claude Codeの使用**:
  ```bash
  claude  # Codespaces内でClaude Codeが利用可能
  ```

---

## 【MVP】コンクリート診断士試験対策アプリ 要件定義書 (Ver. 1.2 Final)

### 1. ユーザー課題と解決策

#### 1.1 ユーザーが解決したい課題

本アプリが解決すべき、ターゲットユーザー（多忙な社会人である受験者）の中心的な課題は以下の通りです。

- **学習時間の確保が難しい**: 「日中は仕事で、夜は疲れている。まとまった学習時間を確保するのが困難だ。」
- **学習道具の携帯が負担**: 「分厚く重い専門書や問題集を毎日持ち歩くのは現実的ではない。」
- **学習の非効率性**: 「自分の苦手分野がどこなのか客観的に把握しづらく、学習が非効率になりがちだ。」

#### 1.2 MVPが提供する解決策 (コアバリュー)

MVPは、上記の課題に対して**「最も重い専門書を、最も軽いスマートフォンの中に。」**をコンセプトに、以下の解決策を提供します。

- 通勤中や昼休みといった**「スキマ時間」を、質の高い学習時間に変える**ことで、学習時間の問題を解決します。
- スマートフォン一つで完結するため、学習道具の携帯という物理的な負担をゼロにします。
- 解答データに基づき、学習の進捗を可視化することで、非効率な学習からの脱却を支援します。

### 2. 開発方針

- **フレームワーク**: Expo / React Native を使用し、iOS・Android両対応のネイティブアプリを効率的に開発する。
- **開発手法**: AI（Claude）を活用し、UIコンポーネントや基本的なロジックのコード生成を効率化する。人間はAIへの指示（プロンプト）と、生成されたコードの調整・統合、ビジネスロジックの実装に注力する。
- **コンテンツ生成**: 問題の解説文は、Azure OpenAI Service (GPT-4)を活用して生成し、専門家による監修を経て品質を担保する。
- **ターゲットプラットフォーム**: MVPでは iOS (App Store) をメインターゲットとする。

### 3. 機能要件（詳細）

#### F-01: ユーザー管理機能（MVPでは簡略化）

| ID      | 要件名                     | 詳細                                                                                            |
| ------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| F-01-01 | デバイスベースユーザー管理 | アプリ初回起動時にデバイスIDを生成し、ユニークなユーザーIDとして使用。Expo Secure Storeに保存。 |
| F-01-02 | ユーザー情報保存           | Azure Cosmos DBにユーザーIDをキーとしたユーザードキュメントを作成。認証は後期バージョンで導入。 |

#### F-02: ホーム画面機能

| ID      | 要件名               | 詳細                                                                                                             |
| ------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| F-02-01 | 年度別問題リスト表示 | アプリ起動後に表示されるメイン画面。学習可能な過去問のリストを年度別に表示する（例：「2024年度」「2023年度」）。 |
| F-02-02 | 学習進捗の簡易表示   | 各年度リストの横に、その年度の進捗状況を「解答済問題数 / 総問題数」の形式で表示する（例: 15 / 50）。             |

#### F-03: 問題演習画面機能 (コア機能)

| ID      | 要件名                   | 詳細                                                                                                                                           |
| ------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| F-03-01 | 問題データ表示           | 画面上部に問題番号と問題文、その下に4つの選択肢をボタンとして表示する。                                                                        |
| F-03-02 | 解答選択ロジック         | 選択肢ボタンは一度だけタップ可能とする。タップされた選択肢は、解答済みであることが視覚的にわかるようにスタイルを変更する（例：背景色を変更）。 |
| F-03-03 | 正誤判定とフィードバック | 解答後、タップした選択肢が正解か不正解かを即座に判定する。正解の選択肢は緑色、不正解の選択肢は赤色でハイライト表示する。                       |
| F-03-04 | 解説表示                 | 正誤判定と同時に、画面下部にスクロール可能なエリアで問題の解説文を表示する。                                                                   |
| F-03-05 | 学習履歴の保存           | 解答結果（どの問題に、いつ、正解/不正解したか）をバックエンドのデータベースに保存する。                                                        |
| F-03-06 | 画面遷移                 | 画面下部に「問題一覧へ戻る」「次の問題へ」のナビゲーションボタンを配置する。                                                                   |

#### F-04: コンテンツ生成・管理

| ID      | 要件名                           | 詳細                                                                                                                                                       |
| ------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-04-01 | 著作権許諾の取得                 | 最優先事項。 **公益社団法人日本コンクリート工学会（JCI）**に対し、過去問題の商用利用に関する正式な許諾を得る。                                             |
| F-04-02 | Azure OpenAI APIによる解説文生成 | 許諾を得た過去問の問題文と正解をインプットとして、Azure OpenAI Service (GPT-4)に専門的かつ分かりやすい解説文を生成させるためのプロンプトを開発・実行する。 |
| F-04-03 | 専門家による監修                 | AIが生成した解説文の内容に誤りがないか、また表現が適切かを、コンクリート診断士の有資格者または同等の専門知識を持つ者が必ず監修・校正する。                 |
| F-04-04 | コンテンツのDB格納               | 監修済みの問題・選択肢・正解・解説文のセットを、アプリから読み込み可能な形式でデータベースに格納する。                                                     |

### 4. 非機能要件

- **UI/UXデザイン**: 学習に集中できる、ミニマルでクリーンなデザイン。色は白を基調とし、アクセントカラーで正誤を直感的に伝える。
- **パフォーマンス**: 画面遷移やAPI通信の応答時間は、ユーザーがストレスを感じない1.5秒以内を目標とする。
- **アーキテクチャ**:
  - フロントエンド: Expo / React Native
  - バックエンド(BaaS): Azure Cosmos DB（ユーザーデータ、学習履歴、問題コンテンツ）、Azure Functions（データ操作API）
  - AI連携: Azure OpenAI Service（解説文生成バッチ処理用）
  - ストレージ: Azure Blob Storage（画像・リソース管理）
- **セキュリティ**:
  - MVPではデバイスIDベースの簡易ユーザー管理を采用。正式な認証は後期バージョンで導入。
  - APIアクセスのRate LimitingとHTTPS通信の強制。
  - センシティブデータはExpo Secure Storeに保存。

### 5. ユーザーフィードバック計画

開発プロセスにおいて、ユーザーからのフィードバックを計画的に収集し、プロダクトの方向性を検証・修正する。

| フェーズ          | タイミング     | 対象ユーザー                      | 収集するフィードバック                                                                                                                |
| ----------------- | -------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 企画・設計段階 | 開発着手前     | 受験経験のある知人・同僚 (3〜5名) | 「こんなアプリがあったら使いたいか？」「いくらなら払うか？」といった、課題の妥当性と解決策の魅力を検証するインタビューを行う。        |
| 2. アルファ版     | コア機能実装後 | 協力的な少数のユーザー (5〜10名)  | 開発中のアプリを直接触ってもらい、「操作は直感的か？」「文字の大きさは適切か？」といったUI/UXの基本的な使いやすさを確認する。         |
| 3. ベータ版       | リリース直前   | 一般公募のテスター (20〜30名)     | App StoreのTestFlight機能を利用し、実際のリリースに近い形でアプリを配信。バグの発見、コンテンツの誤字脱字、全体的な満足度を収集する。 |
| 4. 正式リリース後 | 継続的に       | 全ユーザー                        | App Storeのレビューや、アプリ内に設置した問い合わせフォームから、新機能の要望や改善点を継続的に収集する。                             |

### 6. リスク分析と対策

本プロジェクトに想定されるリスクと、その対策を以下に定義する。

| リスク分類       | 具体的なリスク内容                                                  | 発生確率 | 影響度 | 対策                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 法的・コンテンツ | 日本コンクリート工学会から過去問の利用許諾が得られない。            | 中       | 致命的 | 【最優先】開発着手前に、許諾取得を完了させる。 許諾が得られない場合は、プロジェクトを中止または代替コンテンツ（オリジナル問題作成など）へ方針転換する。                 |
| 法的・コンテンツ | 監修プロセスが不十分で、AIが生成した解説に誤りが含まれてしまう。    | 中       | 高     | 複数の専門家によるクロスチェック体制を構築する。ユーザーからの指摘を迅速に修正できる運用フローを確立する。                                                              |
| 技術的           | AI（Claude）が生成するコードの品質が低く、手戻りが多発する。        | 中       | 中     | AIへの指示（プロンプト）を工夫し、生成の精度を高める。UIなど定型的な部分を中心にAIを活用し、複雑なロジックは手動で実装するなど、役割分担を明確にする。                  |
| 技術的           | App Storeの審査でリジェクト（却下）され、リリースが遅延する。       | 高       | 中     | Appleの審査ガイドラインを事前に熟読し、特に課金や個人情報に関する規約を遵守する。リジェクトを想定し、修正期間をスケジュールに含めておく。                               |
| 市場・ビジネス   | MVPをリリースしたが、想定よりもユーザーが集まらず、売上が伸びない。 | 高       | 高     | 【フィードバック計画の実行】 企画段階でのインタビューを徹底し、ユーザーの課題を正確に捉える。リリース後は、レビューを分析し、ユーザーが真に求める機能改善を迅速に行う。 |

### 7. MVPの範囲外とする機能 🚫

以下の機能は、ユーザーからのフィードバックや需要が確認された後に、バージョン2.0以降で検討する。

- 詳細な成績分析・グラフ表示機能
- AIによる苦手問題の推薦機能
- 記述式問題の対策機能
- ユーザー同士のコミュニティ機能
- ゲーミフィケーション（ポイント、ランキング等）
- オフラインでの学習機能
