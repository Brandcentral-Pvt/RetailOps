// Keepa API Service for Revenue Calculator

const KEEPA_API_BASE = 'https://api.keepa.com';
const KEEPA_PRODUCT_ENDPOINT = '/product';
const KEEPA_CATEGORY_ENDPOINT = '/category';

let accessKey = null;

/**
 * Set the Keepa API access key
 * @param {string} key - The Keepa API access key
 */
export const setAccessKey = (key) => {
  accessKey = key;
};

/**
 * Get the current Keepa API access key
 * @returns {string|null} The current API key
 */
export const getAccessKey = () => {
  return accessKey || localStorage.getItem('keepa-api-key');
};

/**
 * Fetch product data from Keepa API
 * @param {string} asin - The ASIN to fetch
 * @param {string} domain - Amazon domain (default: 'in' for India)
 * @returns {Promise<Object>} Product data from Keepa
 */
export const fetchProductData = async (asin, domain = 'in') => {
  const key = getAccessKey();
  
  if (!key) {
    throw new Error('Keepa API key not set');
  }

  try {
    // Keepa API endpoint for product data
    const url = `${KEEPA_API_BASE}${KEEPA_PRODUCT_ENDPOINT}?key=${key}&domain=${domain}&asin=${asin}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Keepa API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse Keepa response
    if (data.products && data.products.length > 0) {
      return parseKeepaProduct(data.products[0]);
    }
    
    throw new Error('No product data found for ASIN');
  } catch (error) {
    console.error('Keepa API Error:', error);
    throw error;
  }
};

/**
 * Fetch multiple products from Keepa API
 * @param {string[]} asins - Array of ASINs to fetch
 * @param {string} domain - Amazon domain (default: 'in')
 * @returns {Promise<Object[]>} Array of product data
 */
export const fetchMultipleProducts = async (asins, domain = 'in') => {
  const key = getAccessKey();
  
  if (!key) {
    throw new Error('Keepa API key not set');
  }

  try {
    const asinList = asins.join(',');
    const url = `${KEEPA_API_BASE}${KEEPA_PRODUCT_ENDPOINT}?key=${key}&domain=${domain}&asin=${asinList}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Keepa API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.products) {
      return data.products.map(parseKeepaProduct);
    }
    
    return [];
  } catch (error) {
    console.error('Keepa API Error:', error);
    throw error;
  }
};

/**
 * Fetch category data from Keepa API
 * @param {string} domain - Amazon domain (default: 'in')
 * @returns {Promise<Object[]>} Array of categories
 */
export const fetchCategories = async (domain = 'in') => {
  const key = getAccessKey();
  
  if (!key) {
    throw new Error('Keepa API key not set');
  }

  try {
    const url = `${KEEPA_API_BASE}${KEEPA_CATEGORY_ENDPOINT}?key=${key}&domain=${domain}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Keepa API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Keepa Category API Error:', error);
    throw error;
  }
};

/**
 * Parse Keepa product data into a usable format
 * @param {Object} keepaProduct - Raw Keepa product object
 * @returns {Object} Parsed product data
 */
const parseKeepaProduct = (keepaProduct) => {
  // Keepa uses comma-separated values in arrays
  // Index 0 = current price, 1 = last price change, etc.
  
  const parseNumber = (arr, index) => {
    if (arr && arr[index] !== undefined && arr[index] !== -1) {
      return arr[index] / 100; // Keepa prices are in cents
    }
    return null;
  };

  const parseDate = (timestamp) => {
    if (timestamp && timestamp > 0) {
      return new Date(timestamp * 1000).toISOString();
    }
    return null;
  };

  // Extract relevant data from Keepa response
  return {
    asin: keepaProduct.asin,
    title: keepaProduct.title || null,
    
    // Prices (in cents, convert to rupees)
    buyBoxPrice: parseNumber(keepaProduct.csv, 0) || parseNumber(keepaProduct.csv, 1) || null,
    currentPrice: parseNumber(keepaProduct.csv, 0),
    lastPriceChange: parseNumber(keepaProduct.csv, 1),
    currentSalesRank: keepaProduct.salesRankCurrent?.[0] || null,
    
    // Category
    categoryId: keepaProduct.categoryRoot || null,
    category: keepaProduct.categoryTree?.[0]?.name || null,
    
    // Ratings
    rating: keepaProduct.ratingCurrent || null,
    reviewCount: keepaProduct.reviewCountCurrent || null,
    
    // Seller information
    buyBoxIsAmazon: keepaProduct.buyBoxIsAmazon || false,
    
    // Weight (in grams, if available)
    weight: keepaProduct.weight || null,
    
    // Dimensions (if available)
    dimensions: keepaProduct.dimensions || null,
    
    // Brand
    brand: keepaProduct.brand || null,
    
    // Image
    image: keepaProduct.image || keepaProduct.imagesCSV?.split(',')[0] || null,
    
    // Timestamps
    lastUpdate: parseDate(keepaProduct.lastUpdateDate),
    fetchedAt: new Date().toISOString(),
    
    // Raw Keepa data for reference
    raw: keepaProduct,
  };
};

/**
 * Calculate shipping weight based on product dimensions and weight
 * @param {Object} productData - Product data from Keepa
 * @returns {number} Shipping weight in grams
 */
export const calculateShippingWeight = (productData) => {
  // If weight is already provided, use it
  if (productData.weight && productData.weight > 0) {
    return productData.weight;
  }

  // Otherwise, calculate volumetric weight
  if (productData.dimensions && productData.dimensions.length === 3) {
    const [length, width, height] = productData.dimensions;
    // Volumetric weight calculation: (L x W x H) / 5000 (for air freight)
    const volumetricWeight = (length * width * height) / 5000;
    
    // Return the greater of actual or volumetric weight (minimum 100g)
    return Math.max(100, volumetricWeight);
  }

  // Default minimum weight
  return 100;
};

/**
 * Estimate product category from Keepa data
 * @param {Object} productData - Product data from Keepa
 * @returns {string} Estimated category name
 */
export const estimateCategory = (productData) => {
  // If category is provided by Keepa, use it
  if (productData.category) {
    return productData.category;
  }

  // If category ID is provided, try to map it
  if (productData.categoryId) {
    // Common Amazon India category node IDs
    const categoryMap = {
      '1571272031': 'Electronics',
      '283155': 'Books',
      '1571271031': 'Clothing',
      '1571263031': 'Home & Kitchen',
      '1571267031': 'Health & Personal Care',
      '1355016031': 'Beauty',
      '1571266031': 'Sports & Outdoors',
      '1571270031': 'Toys & Games',
      '1571274031': 'Automotive',
      '1571276031': 'Tools & Home Improvement',
    };

    return categoryMap[productData.categoryId] || 'General';
  }

  return 'General';
};

/**
 * Mock function for testing without API key
 * @param {string} asin - The ASIN to mock
 * @returns {Promise<Object>} Mock product data
 */
export const mockFetchProductData = async (asin) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    asin,
    title: `Sample Product for ${asin}`,
    buyBoxPrice: 1999,
    currentPrice: 1999,
    category: 'Electronics',
    categoryId: '1571272031',
    rating: 4.2,
    reviewCount: 150,
    weight: 500,
    dimensions: [20, 15, 10],
    brand: 'Sample Brand',
    image: null,
    lastUpdate: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  };
};

export default {
  setAccessKey,
  getAccessKey,
  fetchProductData,
  fetchMultipleProducts,
  fetchCategories,
  calculateShippingWeight,
  estimateCategory,
  mockFetchProductData,
};
