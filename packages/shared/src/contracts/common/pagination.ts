/**
 * Pagination query parameters
 */
export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

/**
 * Paginated response wrapper
 */
export interface Paginated<T> {
  items: T[];
  total: number;
}
