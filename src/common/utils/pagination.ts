export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function parsePagination(input: { page?: unknown; limit?: unknown }): {
  page: number;
  limit: number;
} {
  const pageRaw = Number(input.page ?? DEFAULT_PAGE);
  const limitRaw = Number(input.limit ?? DEFAULT_LIMIT);
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1
      ? Math.floor(pageRaw)
      : DEFAULT_PAGE;
  const limit =
    Number.isFinite(limitRaw) && limitRaw >= 1
      ? Math.min(MAX_LIMIT, Math.floor(limitRaw))
      : DEFAULT_LIMIT;
  return { page, limit };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    total_pages: Math.max(1, Math.ceil(total / limit)),
  };
}
