// ═══════════════════════════════════════════════════════════════
// SHARED DASHBOARD FORMATTING UTILITIES
// ═══════════════════════════════════════════════════════════════

export const formatIndianCurrencyShort = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    const num = Math.round(val);
    const absNum = Math.abs(num);
    if (absNum >= 10000000) return `₹${(num / 10000000).toFixed(2).replace(/\.?0+$/, '')}Cr`;
    if (absNum >= 100000) return `₹${(num / 100000).toFixed(2).replace(/\.?0+$/, '')}L`;
    if (absNum >= 1000) return `₹${(num / 1000).toFixed(1).replace(/\.?0+$/, '')}K`;
    return `₹${num}`;
};

export const formatIndianCurrencyFull = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
};

export const formatNumber = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return Math.round(val).toLocaleString('en-IN');
};

export const formatCurrency = (val) => {
    return formatIndianCurrencyShort(val);
};

export const formatCompact = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    const num = Math.round(val);
    const absNum = Math.abs(num);
    if (absNum >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (absNum >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (absNum >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString('en-IN');
};
