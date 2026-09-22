export function formatCurrency(
  value: number,
): string {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  }

  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L`;
  }

  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }

  return `₹${value.toLocaleString('en-IN')}`;
}

export function formatNumber(
  value: number,
): string {
  return value.toLocaleString('en-IN');
}