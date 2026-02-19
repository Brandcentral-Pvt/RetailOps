export class Alert {
  constructor(
    id,
    type,
    message,
    severity,
    createdAt,
    acknowledged = false,
    acknowledgedBy = null,
    acknowledgedAt = null,
    data = null
  ) {
    this.id = id;
    this.type = type; // 'revenue', 'inventory', 'ads', 'system'
    this.message = message;
    this.severity = severity; // 'critical', 'warning', 'info'
    this.createdAt = createdAt;
    this.acknowledged = acknowledged;
    this.acknowledgedBy = acknowledgedBy;
    this.acknowledgedAt = acknowledgedAt;
    this.data = data;
  }

  static fromJSON(json) {
    return new Alert(
      json.id,
      json.type,
      json.message,
      json.severity,
      new Date(json.createdAt),
      json.acknowledged,
      json.acknowledgedBy,
      json.acknowledgedAt ? new Date(json.acknowledgedAt) : null,
      json.data
    );
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      message: this.message,
      severity: this.severity,
      createdAt: this.createdAt.toISOString(),
      acknowledged: this.acknowledged,
      acknowledgedBy: this.acknowledgedBy,
      acknowledgedAt: this.acknowledgedAt ? this.acknowledgedAt.toISOString() : null,
      data: this.data
    };
  }

  acknowledge(userId) {
    this.acknowledged = true;
    this.acknowledgedBy = userId;
    this.acknowledgedAt = new Date();
  }
}

export class AlertRule {
  constructor(
    id,
    name,
    type,
    condition,
    severity,
    active = true,
    createdAt,
    updatedAt
  ) {
    this.id = id;
    this.name = name;
    this.type = type; // 'revenue', 'inventory', 'ads', 'system'
    this.condition = condition; // { metric, operator, value, period }
    this.severity = severity; // 'critical', 'warning', 'info'
    this.active = active;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static fromJSON(json) {
    return new AlertRule(
      json.id,
      json.name,
      json.type,
      json.condition,
      json.severity,
      json.active,
      new Date(json.createdAt),
      new Date(json.updatedAt)
    );
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      condition: this.condition,
      severity: this.severity,
      active: this.active,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  evaluate(data) {
    const { metric, operator, value, period } = this.condition;
    
    if (!data[metric]) {
      return false;
    }

    const metricValue = data[metric];
    
    switch (operator) {
      case '>':
        return metricValue > value;
      case '<':
        return metricValue < value;
      case '>=':
        return metricValue >= value;
      case '<=':
        return metricValue <= value;
      case '==':
        return metricValue === value;
      case '!=':
        return metricValue !== value;
      case 'increase':
        return calculatePercentageChange(data, metric, period) > value;
      case 'decrease':
        return calculatePercentageChange(data, metric, period) < -value;
      default:
        return false;
    }
  }
}

const calculatePercentageChange = (data, metric, period) => {
  if (!data.history || !data.history[period]) {
    return 0;
  }
  
  const currentValue = data[metric];
  const previousValue = data.history[period][metric];
  
  if (previousValue === 0) {
    return 0;
  }
  
  return ((currentValue - previousValue) / previousValue) * 100;
};

export const DEFAULT_ALERT_RULES = [
  new AlertRule(
    '1',
    'Revenue Drop Alert',
    'revenue',
    { metric: 'revenue', operator: 'decrease', value: 10, period: '7d' },
    'warning',
    true,
    new Date('2024-01-01'),
    new Date('2024-01-01')
  ),
  new AlertRule(
    '2',
    'Low Inventory Alert',
    'inventory',
    { metric: 'stock', operator: '<', value: 50, period: '1d' },
    'critical',
    true,
    new Date('2024-01-01'),
    new Date('2024-01-01')
  ),
  new AlertRule(
    '3',
    'High ACOS Alert',
    'ads',
    { metric: 'acos', operator: '>', value: 25, period: '7d' },
    'warning',
    true,
    new Date('2024-01-01'),
    new Date('2024-01-01')
  )
];

export const ALERT_TYPE_ICONS = {
  revenue: 'bi bi-graph-down',
  inventory: 'bi bi-box-seam',
  ads: 'bi bi-bullseye',
  system: 'bi bi-gear'
};

export const ALERT_SEVERITY_CLASSES = {
  critical: 'alert-danger',
  warning: 'alert-warning',
  info: 'alert-info'
};
