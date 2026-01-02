# Task 017: アカウント削除機能

## 基本情報

| 項目 | 内容 |
|------|------|
| Phase | App Store申請必須対応 |
| 工数 | 2-3時間 |
| 依存タスク | task016 (Clerk認証) |
| 成果物 | アカウント削除機能（フロントエンド + バックエンド） |

---

## 目的

Apple App Store審査ガイドライン 5.1.1(v) に準拠するため、アプリ内からアカウントを削除する機能を実装する。

> **Guideline 5.1.1(v)**: Apps supporting account creation must also offer account deletion.

---

## 現状分析

### 既存の実装

| 機能 | 状態 | 実装場所 |
|------|------|----------|
| ログアウト | ✅ 実装済み | `app/(tabs)/index.tsx`, `stats.tsx` |
| 学習履歴削除（全体） | ✅ 実装済み | `DELETE /api/answers/user/:userId` |
| 学習履歴削除（分野別） | ✅ 実装済み | `DELETE /api/answers/user/:userId/category/:category` |
| **アカウント削除** | ❌ 未実装 | - |

### データ構造

```sql
-- 削除対象データ
users テーブル: id, device_id, created_at, last_active_at, last_study_date
answers テーブル: user_id に紐づく全レコード

-- 削除時の依存関係
answers.user_id → users.id (FOREIGN KEY)
```

---

## 実装計画

### Phase 1: バックエンドAPI

#### 1.1 ユーザー削除エンドポイント追加

**ファイル**: `workers/src/routes/users.ts`

```typescript
// DELETE /api/users/:userId
users.delete('/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = createDbClient(c.env);

  try {
    // 1. 学習履歴を先に削除（外部キー制約）
    await db.execute({
      sql: 'DELETE FROM answers WHERE user_id = ?',
      args: [userId],
    });

    // 2. ユーザーレコードを削除
    const result = await db.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [userId],
    });

    if (result.rowsAffected === 0) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'アカウントが削除されました',
    });
  } catch (error) {
    return c.json({ success: false, error: 'Deletion failed' }, 500);
  }
});
```

#### 1.2 APIクライアント更新

**ファイル**: `lib/api/client.ts`

```typescript
// API_ENDPOINTS に追加
users: {
  // ... existing
  delete: (userId: string) => `/api/users/${userId}`,
}

// ApiClient クラスに追加
async deleteAccount(userId: string): Promise<ApiResponse<{ message: string }>> {
  return this.request(API_ENDPOINTS.users.delete(userId), {
    method: 'DELETE',
  });
}
```

---

### Phase 2: フロントエンドUI

#### 2.1 アカウント削除ボタン追加

**ファイル**: `app/(tabs)/index.tsx` または新規設定画面

**配置場所の選択肢**:
- A) ホーム画面下部（学習履歴クリアの近く）← 推奨
- B) 統計画面のログアウトボタン近く
- C) 新規の設定画面を作成

#### 2.2 削除確認フロー

```typescript
const handleDeleteAccount = () => {
  Alert.alert(
    'アカウント削除',
    '本当にアカウントを削除しますか？\n\n以下のデータが完全に削除されます：\n・学習履歴\n・ユーザー情報\n\nこの操作は取り消せません。',
    [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除する',
        style: 'destructive',
        onPress: () => confirmDeleteAccount(),
      },
    ]
  );
};

const confirmDeleteAccount = () => {
  // 二段階確認（Apple推奨）
  Alert.alert(
    '最終確認',
    'アカウントを削除すると、すべてのデータが失われます。本当に削除しますか？',
    [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '完全に削除',
        style: 'destructive',
        onPress: async () => {
          try {
            // 1. バックエンドでユーザーデータ削除
            await apiClient.deleteAccount(user.id);

            // 2. ローカルストレージクリア
            await userService.clearUserSession();

            // 3. Clerkからサインアウト
            await signOut();

            // 4. サインイン画面へ遷移
            router.replace('/(public)/sign-in');
          } catch (error) {
            Alert.alert('エラー', 'アカウント削除に失敗しました');
          }
        },
      },
    ]
  );
};
```

#### 2.3 UIデザイン

```
┌─────────────────────────────────────┐
│          ホーム画面下部              │
├─────────────────────────────────────┤
│                                     │
│  [ 学習履歴をクリア ]  ← 既存       │
│                                     │
│  ─────────────────────────          │
│                                     │
│  [ アカウントを削除 ]  ← 新規追加   │
│    赤色・destructive style          │
│                                     │
└─────────────────────────────────────┘
```

---

### Phase 3: Clerk連携（オプション）

Clerkでもユーザーを削除する場合（完全削除）:

```typescript
// Clerk Backend API を呼び出す場合
// workers側でClerk Admin APIを使用
const clerkSecretKey = c.env.CLERK_SECRET_KEY;

await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${clerkSecretKey}`,
  },
});
```

**注意**: MVP段階ではDB削除 + サインアウトで十分。Clerk側の削除は後日対応可能。

---

## ファイル変更一覧

| ファイル | 変更内容 |
|----------|----------|
| `workers/src/routes/users.ts` | DELETE エンドポイント追加 |
| `lib/api/client.ts` | deleteAccount メソッド追加 |
| `lib/api/endpoints.ts` | users.delete エンドポイント定義 |
| `app/(tabs)/index.tsx` | アカウント削除ボタン・処理追加 |

---

## テスト項目

### 機能テスト

- [ ] アカウント削除ボタンが表示される
- [ ] 確認ダイアログが表示される（2段階）
- [ ] 削除後、学習履歴がDBから削除される
- [ ] 削除後、ユーザーレコードがDBから削除される
- [ ] 削除後、ローカルストレージがクリアされる
- [ ] 削除後、サインイン画面に遷移する

### エッジケース

- [ ] 削除中にネットワークエラーが発生した場合
- [ ] 存在しないユーザーIDの削除を試みた場合
- [ ] 削除処理中に二重タップした場合

---

## Apple審査対応チェックリスト

- [ ] アプリ内からアカウント削除を開始できる
- [ ] 削除前に確認ダイアログを表示する
- [ ] 削除されるデータの種類を明示する
- [ ] 削除は完全削除である（30日後削除などではない）
- [ ] サポートページにもアカウント削除方法を記載する

---

## 注意事項

1. **データ完全削除**: Appleは「一定期間後に削除」ではなく即時削除を推奨
2. **二段階確認**: 誤操作防止のため、2回の確認ダイアログを表示
3. **サポートページ更新**: アカウント削除方法をFAQに追記する

---

## 参考資料

- [Apple App Store Review Guidelines 5.1.1](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage)
- [Clerk User Deletion API](https://clerk.com/docs/reference/backend-api/tag/Users#operation/DeleteUser)

---

## 次のタスク

→ [task014-testflight-beta.md](./task014-testflight-beta.md)
