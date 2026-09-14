/**
 * Reusable Pagination & Query Bounds Sanitizer (Phase G)
 * 
 * Enforces:
 * - Deterministic, bounded pagination
 * - Safe maximum page size (max 100) to prevent memory exhaustion and DoS
 * - Non-negative integer parsing for page and limit
 * - Uniform pagination metadata format
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Sanitizes and bounds pagination parameters from request queries.
 * @param {object} query - Express req.query
 * @param {number} defaultLimit - Optional custom default limit (capped at MAX_LIMIT)
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePagination(query = {}, defaultLimit = DEFAULT_LIMIT) {
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = DEFAULT_PAGE;
  }

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  }

  // Strictly cap at MAX_LIMIT (100)
  limit = Math.min(limit, MAX_LIMIT);

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Formats standardized pagination response metadata.
 * @param {number} totalCount - Total matching records in database
 * @param {number} page - Current 1-indexed page
 * @param {number} limit - Items per page
 * @returns {object}
 */
function getPaginationMeta(totalCount, page, limit) {
  const total = Math.max(0, Number(totalCount) || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePagination,
  getPaginationMeta,
};
