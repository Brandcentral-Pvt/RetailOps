const asinTableService = require('../services/asinTableService');
const asinScope = require('../utils/asinScope');

/**
 * ASIN Table Controller - Unified Integration Layer
 * Serves optimized JSON payloads for high-performance table views.
 */
class AsinTableController {
  
  /**
   * GET /api/asins/table
   * Main entry point for the ASIN Intelligence table view
   */
  async getAsinTable(req, res) {
    try {
      const { 
        sellerId, search, category, 
        page = 1, limit = 50,
        sortBy = 'CreatedAt', sortOrder = 'DESC'
      } = req.query;

      // 1. Resolve the caller's seller scope — this endpoint used to answer for
      //    every seller in the database (docs/asin-manager-deep-dive.md → F1)
      const scope = asinScope.scopeFor(req, sellerId);
      if (scope.denied || scope.empty) return asinScope.forbidden(res);

      // 2. Delegate to service for orchestration
      const result = await asinTableService.getAsinTableData({
        scope,
        search,
        category,
        page,
        limit,
        sortBy,
        sortOrder
      });

      // 2. Return response in format expected by frontend
      res.status(200).json({
        success: true,
        asins: result.data,
        pagination: result.pagination
      });

    } catch (error) {
      console.error('[AsinTableController] Error fetching table data:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error fetching ASIN intelligence',
        error: error.message
      });
    }
  }
}

module.exports = new AsinTableController();
