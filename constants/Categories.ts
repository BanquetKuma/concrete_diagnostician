/**
 * Category definitions and ordering for the concrete diagnostician app
 * This is the single source of truth for category order and labels
 */

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
