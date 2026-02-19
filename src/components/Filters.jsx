import React, { useState } from 'react';

const Filters = ({
  filters,
  onFilterChange,
  showDateRange = true,
  showCategory = true,
  showSearch = true,
  showCampaignType = false,
  showStatus = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFilterChange({ [name]: value });
  };

  const handleSearchChange = (e) => {
    onFilterChange({ searchTerm: e.target.value });
  };

  const handleReset = () => {
    onFilterChange({
      dateRange: 'last30',
      category: 'all',
      searchTerm: '',
      campaignType: 'all',
      status: 'all'
    });
  };

  return (
    <div className="filters-container">
      <div className="filters-header">
        <button
          className="filters-toggle-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <i className={`bi bi-funnel${isExpanded ? '-fill' : ''}`}></i>
          Filters
          <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} ms-2`}></i>
        </button>
      </div>

      <div className={`filters-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="filter-row">
          {showSearch && (
            <div className="filter-group-inline" style={{ flex: 2 }}>
              <label className="form-label">
                <i className="bi bi-search me-1"></i>
                Search
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Search SKU, ASIN, title..."
                value={filters.searchTerm || ''}
                onChange={handleSearchChange}
              />
            </div>
          )}

          {showDateRange && (
            <div className="filter-group-inline">
              <label className="form-label">
                <i className="bi bi-calendar3 me-1"></i>
                Date Range
              </label>
              <select
                name="dateRange"
                className="form-control form-select"
                value={filters.dateRange || 'last30'}
                onChange={handleInputChange}
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 Days</option>
                <option value="last14">Last 14 Days</option>
                <option value="last30">Last 30 Days</option>
                <option value="last60">Last 60 Days</option>
                <option value="last90">Last 90 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="thisQuarter">This Quarter</option>
                <option value="thisYear">This Year</option>
              </select>
            </div>
          )}

          {showCategory && (
            <div className="filter-group-inline">
              <label className="form-label">
                <i className="bi bi-collection me-1"></i>
                Category
              </label>
              <select
                name="category"
                className="form-control form-select"
                value={filters.category || 'all'}
                onChange={handleInputChange}
              >
                <option value="all">All Categories</option>
                <option value="Electronics">Electronics</option>
                <option value="Home & Kitchen">Home & Kitchen</option>
                <option value="Sports">Sports</option>
                <option value="Books">Books</option>
                <option value="Clothing">Clothing</option>
                <option value="Toys">Toys</option>
                <option value="Beauty">Beauty</option>
                <option value="Automotive">Automotive</option>
              </select>
            </div>
          )}

          {showCampaignType && (
            <div className="filter-group-inline">
              <label className="form-label">
                <i className="bi bi-megaphone me-1"></i>
                Campaign Type
              </label>
              <select
                name="campaignType"
                className="form-control form-select"
                value={filters.campaignType || 'all'}
                onChange={handleInputChange}
              >
                <option value="all">All Types</option>
                <option value="Sponsored Products">Sponsored Products</option>
                <option value="Sponsored Brands">Sponsored Brands</option>
                <option value="Sponsored Display">Sponsored Display</option>
                <option value="Sponsored TV">Sponsored TV</option>
              </select>
            </div>
          )}

          {showStatus && (
            <div className="filter-group-inline">
              <label className="form-label">
                <i className="bi bi-toggle-on me-1"></i>
                Status
              </label>
              <select
                name="status"
                className="form-control form-select"
                value={filters.status || 'all'}
                onChange={handleInputChange}
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Paused">Paused</option>
                <option value="Ended">Ended</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
          )}

          <div className="filter-actions-inline">
            <button
              className="btn btn-secondary"
              onClick={handleReset}
              title="Reset Filters"
            >
              <i className="bi bi-arrow-clockwise"></i>
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Filters;
