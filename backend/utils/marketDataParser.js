/**
 * Pure, shared parsing helpers for market-data (Octoparse / scrape) ingestion.
 * No DB or network dependencies — unit-testable in isolation.
 * Used by both marketDataSyncService (Path A) and asinDataParser (Path B) so the
 * two ingestion paths agree on how review-rating and A+ data is interpreted.
 */

// ---------------------------------------------------------------------------
// Generic field lookup (case/space-insensitive on keys)
// ---------------------------------------------------------------------------
function getFromRaw(rawData, fieldNames, defaultValue = null) {
    if (!rawData) return defaultValue;

    const rawKeys = Object.keys(rawData);
    const keyMap = {};
    for (const k of rawKeys) {
        keyMap[k.toLowerCase().trim()] = k;
    }

    for (const field of fieldNames) {
        const normalizedField = field.toLowerCase().trim();
        const actualKey = keyMap[normalizedField];
        if (actualKey) {
            const value = rawData[actualKey];
            if (value !== undefined && value !== null && value !== '') {
                if (typeof value === 'string' && value.trim() === '') continue;
                return value;
            }
        }
    }
    return defaultValue;
}

// ---------------------------------------------------------------------------
// Star rating value (0–5)
// ---------------------------------------------------------------------------
const clampRating = (val) => {
    const n = Math.round(val * 10) / 10;
    if (isNaN(n)) return 0;
    return Math.min(5, Math.max(0, n));
};

/**
 * Parse a star rating from number/string/object.
 * Handles "4.2 out of 5 stars", "4,2 out of 5", plain numbers, and { value }.
 */
function parseRatingValue(value) {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return clampRating(value);
    if (typeof value === 'object' && !Array.isArray(value)) {
        const candidate = value.value ?? value.starRating ?? value.averageRating ?? value.displayValue;
        if (candidate !== undefined && candidate !== null) return parseRatingValue(candidate);
        return 0;
    }

    let s = String(value).trim();
    if (!s) return 0;

    // "4.2 out of 5 stars" or "4,2 out of 5"
    const outOfMatch = s.match(/(\d+(?:[.,]\d+)?)\s*out\s*of\s*5/i);
    if (outOfMatch) return clampRating(parseFloat(outOfMatch[1].replace(',', '.')));

    // First numeric token (clamped to 0–5 downstream)
    const numMatch = s.match(/(-?\d+(?:[.,]\d+)?)/);
    if (numMatch) return clampRating(parseFloat(numMatch[1].replace(',', '.')));

    return 0;
}

// ---------------------------------------------------------------------------
// Review / rating count
// ---------------------------------------------------------------------------
/**
 * Parse a review/rating count from messy Octoparse strings.
 * Handles "(2,441)", "1,234 global ratings", "89 reviews", and the "smashed"
 * Amazon histogram like "4.2 out of 5 stars1,234 global ratings5 star63%...".
 */
function parseReviewCount(value) {
    if (value === undefined || value === null || value === '') return 0;

    let s = String(value).trim();
    if (!s) return 0;

    // Remove Amazon rating noise that often smashes into the count
    s = s.replace(/out\s+of\s+[0-5](?:\.[0-9])?/gi, '');
    s = s.replace(/[0-5]\s*stars?/gi, '');

    // Parenthesized counts: "(2,441)"
    const parenMatch = s.match(/\(([\d,]+)\)/);
    if (parenMatch) {
        const val = parseInt(parenMatch[1].replace(/,/g, ''), 10);
        if (val > 0) return val;
    }

    // Labelled counts: "1,234 global ratings", "89 reviews"
    const globalMatch = s.match(/([\d,]+)\s*(?:global\s*ratings?|ratings?|reviews?)/i);
    if (globalMatch) {
        const val = parseInt(globalMatch[1].replace(/,/g, ''), 10);
        if (val > 0) return val;
    }

    // Fallback: scan numeric runs, skipping percentages and tiny fragments
    const allNumericMatches = s.match(/[\d,]+/g);
    if (allNumericMatches) {
        for (const m of allNumericMatches) {
            const pos = s.indexOf(m);
            if (pos !== -1 && s[pos + m.length] === '%') continue;
            const val = parseInt(m.replace(/,/g, ''), 10);
            if (val > 10 && val < 50000000) return val;
            if (val > 0 && !s.toLowerCase().includes('star')) return val;
        }
    }

    return 0;
}

// ---------------------------------------------------------------------------
// Rating breakdown (5★ / 4★ / 3★ / 2★ / 1★ percentages)
// ---------------------------------------------------------------------------
const EMPTY_BREAKDOWN = { fiveStar: 0, fourStar: 0, threeStar: 0, twoStar: 0, oneStar: 0 };

function normalizeBreakdown(b) {
    if (!b || typeof b !== 'object') return EMPTY_BREAKDOWN;
    return {
        fiveStar: Number(b.fiveStar) || 0,
        fourStar: Number(b.fourStar) || 0,
        threeStar: Number(b.threeStar) || 0,
        twoStar: Number(b.twoStar) || 0,
        oneStar: Number(b.oneStar) || 0
    };
}

/**
 * Parse a rating breakdown from HTML or a string like
 * "5 star63%4 star22%3 star9%2 star3%1 star3%" or "53%23%12%5%7%".
 */
function parseRatingBreakdown(ratingStr) {
    const breakdown = { ...EMPTY_BREAKDOWN };

    if (!ratingStr) return breakdown;

    const s = ratingStr.toString().replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    if (!s) return breakdown;

    // Method 1: pattern like "53%23%12%5%7%" (percentages only, 5-star first)
    const percMatch = s.match(/(\d{1,3})%[^\d]*?(\d{1,3})%[^\d]*?(\d{1,3})%[^\d]*?(\d{1,3})%[^\d]*?(\d{1,3})%/);
    if (percMatch) {
        breakdown.fiveStar = parseFloat(percMatch[1]) || 0;
        breakdown.fourStar = parseFloat(percMatch[2]) || 0;
        breakdown.threeStar = parseFloat(percMatch[3]) || 0;
        breakdown.twoStar = parseFloat(percMatch[4]) || 0;
        breakdown.oneStar = parseFloat(percMatch[5]) || 0;
        const sum = breakdown.fiveStar + breakdown.fourStar + breakdown.threeStar + breakdown.twoStar + breakdown.oneStar;
        if (sum > 0) return breakdown;
    }

    // Method 2: individual stars like "5 star34%" / "5★ 34%"
    const starPattern = /(\d)\s*(?:star|★|stars?)[^%]*?(\d{1,3})%/gi;
    let match;
    const starMap = {};
    while ((match = starPattern.exec(s)) !== null) {
        const starNum = parseInt(match[1], 10);
        const pct = parseInt(match[2], 10);
        if (starNum >= 1 && starNum <= 5 && !isNaN(pct)) {
            starMap[starNum] = pct;
        }
    }
    if (Object.keys(starMap).length === 5) {
        breakdown.fiveStar = starMap[5] || 0;
        breakdown.fourStar = starMap[4] || 0;
        breakdown.threeStar = starMap[3] || 0;
        breakdown.twoStar = starMap[2] || 0;
        breakdown.oneStar = starMap[1] || 0;
        return breakdown;
    }

    // Method 3: simple percentage list without labels
    const simplePercs = s.match(/(\d{1,3})%/g);
    if (simplePercs && simplePercs.length >= 5) {
        breakdown.fiveStar = parseInt(simplePercs[0], 10) || 0;
        breakdown.fourStar = parseInt(simplePercs[1], 10) || 0;
        breakdown.threeStar = parseInt(simplePercs[2], 10) || 0;
        breakdown.twoStar = parseInt(simplePercs[3], 10) || 0;
        breakdown.oneStar = parseInt(simplePercs[4], 10) || 0;
        return breakdown;
    }

    return breakdown;
}

/**
 * Compute an average star rating from a breakdown of percentages.
 * e.g. {fiveStar:63,...} -> 4.5
 */
function computeRatingFromBreakdown(breakdown) {
    const b = normalizeBreakdown(breakdown);
    const sum = b.fiveStar + b.fourStar + b.threeStar + b.twoStar + b.oneStar;
    if (sum <= 0) return 0;
    const weighted = (5 * b.fiveStar + 4 * b.fourStar + 3 * b.threeStar + 2 * b.twoStar + b.oneStar) / 100;
    return Math.round(weighted * 10) / 10;
}

/**
 * Safely parse a stored RatingBreakdown JSON column value.
 * Returns a normalized breakdown object, or null when invalid/empty.
 */
function safeParseRatingBreakdown(str) {
    if (!str) return null;
    let parsed;
    try {
        parsed = typeof str === 'string' ? JSON.parse(str) : str;
    } catch (e) {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return normalizeBreakdown(parsed);
}

// ---------------------------------------------------------------------------
// A+ content
// ---------------------------------------------------------------------------
// NOTE: deliberately excludes 'productDescription_feature_div' — that is the
// product *description* container on Amazon, not A+ content.
const APLUS_MARKERS = [
    'aplus-v2', 'aplus-standard', 'aplus-module', 'launchpad-module',
    'apm-', 'aplus-content-wrapper', 'aplus_feature_div',
    'aplus-3p-fixed-width', 'aplus-banner', 'aplus-image',
    'shoppable', 'aplus_media', 'aplusBlock'
];

const APLUS_TRUE_STRINGS = ['true', 'yes', '1', 'y', 'present', 'available'];
const APLUS_FALSE_STRINGS = [
    'false', 'no', '0', 'n', 'none', 'null', 'na', 'n/a',
    'not found', 'not available', 'not present', 'no a+', 'a+ not present', 'a+ not available'
];

/**
 * Decide whether raw A+ field content indicates A+ is present.
 * Accepts strings (HTML, JSON, boolean-like text) or pre-parsed objects/arrays.
 */
function hasAplusContent(html) {
    if (!html) return false;

    if (typeof html === 'object') {
        if (Array.isArray(html)) return html.length > 0;
        return Object.keys(html).length > 0;
    }
    if (typeof html !== 'string') html = String(html);

    const trimmed = html.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();

    if (APLUS_TRUE_STRINGS.includes(lower)) return true;
    if (APLUS_FALSE_STRINGS.includes(lower)) return false;

    // Stringified JSON arrays/objects
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed.length > 0;
            return Object.keys(parsed).length > 0;
        } catch (e) { /* fall through */ }
    }

    // Known A+ DOM markers
    for (const marker of APLUS_MARKERS) {
        if (lower.includes(marker)) return true;
    }

    // Structured A+ HTML: must contain actual A+ media/layout, not just any HTML
    if (trimmed.includes('<') && trimmed.includes('>')) {
        const imgCount = (trimmed.match(/<img/gi) || []).length;
        if (imgCount >= 1 && trimmed.length > 150) return true;

        const moduleMatches = (trimmed.match(/<section|aplus-module|apm-module|aplus-standard|launchpad-module/gi) || []);
        if (moduleMatches.length >= 2 && trimmed.length > 200) return true;
    }

    return false;
}

/**
 * Detect A+ presence from an Octoparse row (rawData object).
 * Priority 1: explicit boolean/flag fields. Priority 2: A+ content fields.
 */
function detectAplusContent(rawData) {
    if (!rawData) return false;

    const explicitFlags = ['has_aplus', 'A_plus', 'A+', 'A Plus', 'A+ Content', 'aplus', 'AplusContent', 'hasAplus', 'isAplus'];
    for (const flag of explicitFlags) {
        const val = rawData[flag];
        if (val === undefined || val === null) continue;

        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val > 0;
        if (typeof val === 'object') {
            if (Array.isArray(val)) return val.length > 0;
            return Object.keys(val).length > 0;
        }
        if (typeof val === 'string') {
            const trimmed = val.trim();
            const lower = trimmed.toLowerCase();
            if (APLUS_TRUE_STRINGS.includes(lower)) return true;
            if (APLUS_FALSE_STRINGS.includes(lower)) return false;
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) return parsed.length > 0;
                    return Object.keys(parsed).length > 0;
                } catch (e) { /* fall through */ }
            }
            // If the flag field itself holds A+ HTML, evaluate it structurally
            if (trimmed.includes('<')) return hasAplusContent(trimmed);
        }
    }

    // Priority 2: dedicated A+ content fields (NOT product description)
    const contentField = getFromRaw(rawData, ['A_plus', 'aplus_content', 'aplus', 'A+', 'A Plus', 'A+ Content', 'AplusContent'], '');
    if (contentField) {
        if (typeof contentField === 'object') {
            if (Array.isArray(contentField)) return contentField.length > 0;
            return Object.keys(contentField).length > 0;
        }
        return hasAplusContent(contentField);
    }

    return false;
}

/**
 * Distinguish "scrape captured A+ data (present OR absent)" from
 * "scrape captured no A+ field at all". Returns true when any A+ column
 * carries a real value (including explicit negatives like `has_aplus=false`
 * or `A_plus="No A+ content found"`), and false when every A+ column is
 * missing or empty — which lets callers preserve existing A+ state instead
 * of treating a blank capture as "A+ absent".
 */
function hasAplusSignal(rawData) {
    if (!rawData || typeof rawData !== 'object') return false;

    const signalFields = [
        'has_aplus', 'A_plus', 'aplus', 'A+', 'A Plus', 'A+ Content',
        'aplus_content', 'AplusContent', 'hasAplus', 'isAplus'
    ];
    for (const field of signalFields) {
        const val = getFromRaw(rawData, [field]);
        if (val === undefined || val === null) continue;
        if (typeof val === 'object') {
            if (Array.isArray(val)) { if (val.length > 0) return true; continue; }
            if (Object.keys(val).length > 0) return true;
            continue;
        }
        // Boolean (incl. `false`), number, or non-empty string all count
        return true;
    }
    return false;
}

module.exports = {
    getFromRaw,
    parseRatingValue,
    parseReviewCount,
    parseRatingBreakdown,
    computeRatingFromBreakdown,
    safeParseRatingBreakdown,
    normalizeBreakdown,
    hasAplusContent,
    detectAplusContent,
    hasAplusSignal,
    APLUS_MARKERS
};
