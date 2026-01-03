/**
 * Category definitions and ordering for the concrete diagnostician app
 * This is the single source of truth for category order and labels
 */

// ===== FREEMIUM SETTINGS =====
// 各カテゴリの無料問題割合（40%）
export const FREE_QUESTION_RATIO = 0.4;

// カテゴリごとの総問題数
export const CATEGORY_QUESTION_COUNTS: Record<string, number> = {
  'materials': 36,
  'mix-design': 36,
  'construction': 36,
  'quality': 35,
  'deterioration': 36,
  'diagnosis': 36,
  'repair': 35,
};

/**
 * カテゴリ内の無料問題上限を取得
 */
export function getFreeQuestionLimit(category: string): number {
  const total = CATEGORY_QUESTION_COUNTS[category] || 0;
  return Math.floor(total * FREE_QUESTION_RATIO);
}

/**
 * 問題がロックされているかチェック（Pro会員でない場合）
 */
export function isQuestionLocked(category: string, questionNumber: number): boolean {
  const freeLimit = getFreeQuestionLimit(category);
  return questionNumber > freeLimit;
}

// ===== CATEGORY DEFINITIONS =====

// Canonical category order - used for consistent display across the app
export const CATEGORY_ORDER: string[] = [
  'materials',      // コンクリート材料
  'mix-design',     // 配合設計
  'construction',   // 施工
  'quality',        // 品質管理・検査
  'deterioration',  // 劣化・損傷
  'diagnosis',      // 調査・診断
  'repair',         // 補修・補強
];

// Japanese labels for each category
export const CATEGORY_LABELS: Record<string, string> = {
  'materials': 'コンクリート材料',
  'mix-design': '配合設計',
  'construction': '施工',
  'quality': '品質管理・検査',
  'deterioration': '劣化・損傷',
  'diagnosis': '調査・診断',
  'repair': '補修・補強',
};

/**
 * Sort an array of items by category using the canonical order
 * Items with unknown categories are placed at the end
 */
export function sortByCategory<T extends { category: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(a.category);
    const indexB = CATEGORY_ORDER.indexOf(b.category);
    // Unknown categories go to the end
    const orderA = indexA === -1 ? CATEGORY_ORDER.length : indexA;
    const orderB = indexB === -1 ? CATEGORY_ORDER.length : indexB;
    return orderA - orderB;
  });
}

/**
 * Get the Japanese label for a category code
 */
export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}
