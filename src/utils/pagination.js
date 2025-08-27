const { DEFAULT_PAGINATION } = require('../config/constants');

class PaginationHelper {
  static paginate(data, page = DEFAULT_PAGINATION.PAGE, limit = DEFAULT_PAGINATION.LIMIT) {
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), DEFAULT_PAGINATION.MAX_LIMIT);
    
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = pageNum * limitNum;
    
    const paginatedData = data.slice(startIndex, endIndex);
    
    return {
      data: paginatedData,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(data.length / limitNum),
        totalItems: data.length,
        limit: limitNum,
        hasNext: endIndex < data.length,
        hasPrev: startIndex > 0
      }
    };
  }

  static validatePaginationParams(page, limit) {
    const pageNum = Math.max(1, parseInt(page) || DEFAULT_PAGINATION.PAGE);
    const limitNum = Math.min(
      Math.max(1, parseInt(limit) || DEFAULT_PAGINATION.LIMIT),
      DEFAULT_PAGINATION.MAX_LIMIT
    );
    
    return { page: pageNum, limit: limitNum };
  }

  static createPaginationQuery(baseUrl, page, limit, totalPages, filters = {}) {
    const query = new URLSearchParams(filters);
    
    const pagination = {
      current: `${baseUrl}?${query.toString()}&page=${page}&limit=${limit}`,
      first: `${baseUrl}?${query.toString()}&page=1&limit=${limit}`,
      last: `${baseUrl}?${query.toString()}&page=${totalPages}&limit=${limit}`
    };

    if (page > 1) {
      pagination.prev = `${baseUrl}?${query.toString()}&page=${page - 1}&limit=${limit}`;
    }

    if (page < totalPages) {
      pagination.next = `${baseUrl}?${query.toString()}&page=${page + 1}&limit=${limit}`;
    }

    return pagination;
  }
}

module.exports = PaginationHelper;