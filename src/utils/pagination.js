const { DEFAULT_PAGINATION } = require('../config/constants');

class PaginationHelper {
  static validatePaginationParams(page = 1, limit = 10) {
    const validPage = Math.max(1, parseInt(page) || 1);
    const validLimit = Math.min(
      Math.max(1, parseInt(limit) || DEFAULT_PAGINATION.LIMIT),
      DEFAULT_PAGINATION.MAX_LIMIT
    );
    
    return { page: validPage, limit: validLimit };
  }

  static paginate(data, page, limit) {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedData = data.slice(startIndex, endIndex);
    
    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(data.length / limit),
      totalItems: data.length,
      limit: limit,
      hasNext: endIndex < data.length,
      hasPrev: startIndex > 0
    };
    
    return { data: paginatedData, pagination };
  }
}

module.exports = PaginationHelper;