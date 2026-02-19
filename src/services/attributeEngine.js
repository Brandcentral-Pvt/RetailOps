// Category-specific attribute mapping
export const getCategoryAttributes = (category) => {
  const attributeMaps = {
    apparel: {
      variant1: 'size',
      variant2: 'color'
    },
    electronics: {
      variant1: 'storage',
      variant2: 'ram'
    },
    fmcg: {
      variant1: 'pack_size',
      variant2: 'flavor'
    },
    home_goods: {
      variant1: 'material',
      variant2: 'finish'
    },
    beauty: {
      variant1: 'shade',
      variant2: 'formula'
    },
    industrial: {
      variant1: 'voltage',
      variant2: 'capacity'
    },
    general: {
      variant1: 'attribute1',
      variant2: 'attribute2'
    }
  };
  return attributeMaps[category] || attributeMaps.general;
};

// Category options with labels and icons
export const categoryOptions = [
  { value: 'general', label: 'All Categories', icon: 'bi bi-grid-3x3-gap' },
  { value: 'apparel', label: 'Apparel', icon: 'bi bi-shop-window' },
  { value: 'electronics', label: 'Electronics', icon: 'bi bi-laptop' },
  { value: 'fmcg', label: 'FMCG', icon: 'bi bi-cart3' },
  { value: 'home_goods', label: 'Home Goods', icon: 'bi bi-house' },
  { value: 'beauty', label: 'Beauty', icon: 'bi bi-palette' },
  { value: 'industrial', label: 'Industrial', icon: 'bi bi-gear' }
];

// Get attribute options based on category
export const getAttributeOptions = (category, attributeType) => {
  const attributeValues = {
    apparel: {
      size: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'],
      color: ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow']
    },
    electronics: {
      storage: ['64GB', '128GB', '256GB', '512GB', '1TB'],
      ram: ['4GB', '8GB', '16GB', '32GB']
    },
    fmcg: {
      pack_size: ['Single', '2-Pack', '4-Pack', '6-Pack', '12-Pack'],
      flavor: ['Chocolate', 'Vanilla', 'Strawberry', 'Mint']
    },
    home_goods: {
      material: ['Wood', 'Metal', 'Plastic', 'Glass', 'Fabric'],
      finish: ['Matte', 'Glossy', 'Brushed', 'Textured']
    },
    beauty: {
      shade: ['Light', 'Medium', 'Dark', 'Deep'],
      formula: ['Cream', 'Liquid', 'Powder', 'Gel']
    },
    industrial: {
      voltage: ['110V', '220V', '240V'],
      capacity: ['10L', '20L', '50L', '100L']
    },
    general: {
      attribute1: ['Option1', 'Option2', 'Option3'],
      attribute2: ['Value1', 'Value2', 'Value3']
    }
  };

  const categoryValues = attributeValues[category] || attributeValues.general;
  return categoryValues[attributeType] || [];
};

// Get chart title based on category and type
export const getChartTitle = (chartType, category) => {
  const chartConfigs = {
    apparel: {
      bar: 'Revenue by Size',
      pie: 'Size Share',
      line: 'Monthly Revenue Trend'
    },
    electronics: {
      bar: 'Revenue by Storage',
      pie: 'Storage Share',
      line: 'Monthly Revenue Trend'
    },
    fmcg: {
      bar: 'Revenue by Pack Size',
      pie: 'Pack Size Share',
      line: 'Monthly Revenue Trend'
    },
    home_goods: {
      bar: 'Revenue by Material',
      pie: 'Material Share',
      line: 'Monthly Revenue Trend'
    },
    beauty: {
      bar: 'Revenue by Shade',
      pie: 'Shade Share',
      line: 'Monthly Revenue Trend'
    },
    industrial: {
      bar: 'Revenue by Voltage',
      pie: 'Voltage Share',
      line: 'Monthly Revenue Trend'
    },
    general: {
      bar: 'Revenue by Attribute 1',
      pie: 'Attribute 1 Share',
      line: 'Monthly Revenue Trend'
    }
  };

  const categoryConfig = chartConfigs[category] || chartConfigs.general;
  return categoryConfig[chartType] || categoryConfig.bar;
};

// Get chart configuration based on category
export const getChartConfig = (category, chartType) => {
  const chartConfigs = {
    apparel: {
      bar: { title: 'Revenue by Size', xAxis: 'Size' },
      pie: { title: 'Size Share', label: 'Size' },
      line: { title: 'Monthly Revenue Trend', xAxis: 'Month' }
    },
    electronics: {
      bar: { title: 'Revenue by Storage', xAxis: 'Storage' },
      pie: { title: 'Storage Share', label: 'Storage' },
      line: { title: 'Monthly Revenue Trend', xAxis: 'Month' }
    },
    fmcg: {
      bar: { title: 'Revenue by Pack Size', xAxis: 'Pack Size' },
      pie: { title: 'Pack Size Share', label: 'Pack Size' },
      line: { title: 'Monthly Revenue Trend', xAxis: 'Month' }
    },
    home_goods: {
      bar: { title: 'Revenue by Material', xAxis: 'Material' },
      pie: { title: 'Material Share', label: 'Material' },
      line: { title: 'Monthly Revenue Trend', xAxis: 'Month' }
    },
    beauty: {
      bar: { title: 'Revenue by Shade', xAxis: 'Shade' },
      pie: { title: 'Shade Share', label: 'Shade' },
      line: { title: 'Monthly Revenue Trend', xAxis: 'Month' }
    },
    industrial: {
      bar: { title: 'Revenue by Voltage', xAxis: 'Voltage' },
      pie: { title: 'Voltage Share', label: 'Voltage' },
      line: { title: 'Monthly Revenue Trend', xAxis: 'Month' }
    },
    general: {
      bar: { title: 'Revenue by Attribute 1', xAxis: 'Attribute 1' },
      pie: { title: 'Attribute 1 Share', label: 'Attribute 1' },
      line: { title: 'Monthly Revenue Trend', xAxis: 'Month' }
    }
  };

  const categoryConfig = chartConfigs[category] || chartConfigs.general;
  return categoryConfig[chartType] || categoryConfig.bar;
};
