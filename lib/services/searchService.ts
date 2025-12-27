/**
 * Search Service (Stub)
 *
 * Purpose: Placeholder for future search functionality
 * Note: Full implementation with Azure AI Search is planned for post-MVP
 */

/**
 * Search query configuration
 */
export interface SearchQuery {
  searchText: string;
  top?: number;
  filter?: string;
}

/**
 * Search result
 */
export interface SearchResult {
  chunkId: string;
  content: string;
  title?: string;
  score: number;
}

/**
 * Search service stub - to be implemented post-MVP
 */
export const searchService = {
  /**
   * Search for relevant content (stub)
   */
  async search(_query: SearchQuery): Promise<SearchResult[]> {
    console.warn('Search service not implemented in MVP');
    return [];
  },

  /**
   * Health check (stub)
   */
  async healthCheck(): Promise<boolean> {
    return true;
  },
};
