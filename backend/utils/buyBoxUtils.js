/**
 * Authorized sellers list for BuyBox winning status.
 * Includes common spelling variations and substrings for robust matching.
 */
const OWN_SELLERS = [
    'Cocoblu Retail',
    'Cocblu Retail',
    'Cocoblu',
    'Cocblu',
    'Cocoblu Retail Private Limited',
    'Cocblu Retail Private Limited',
    'Cocoblu Retail India',
    'Cocblu Retail India',
    'Cocoblu India',
    'Clicktech Retail Private Ltd',
    'Clicktech Retail',
    'Clicktech India',
    'RetailEZ Pvt Ltd',
    'RetailEZ Private Limited',
    'RetailEZ India',
    'ETrade Pvt Ltd',
    'ETrade Private Limited',
    'Appario Retail',
    'Appario'
];

/**
 * Robustly identifies if a seller is authorized based on given names.
 * Implements partial matching (ignores spaces, casing, and special characters).
 * 
 * @param {string} soldBy - The seller name found on Amazon
 * @returns {boolean} - true if the seller is authorized (Won), false otherwise (Lost)
 */
function isBuyBoxWinner(soldBy) {
    if (!soldBy) return false;
    
    // Normalize: lowercase, remove non-alphanumeric characters, and trim
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const normalizedSoldBy = normalize(soldBy);
    
    if (!normalizedSoldBy) return false;

    const result = OWN_SELLERS.some(s => {
        const authorized = normalize(s);
        if (!authorized) return false;
        
        // Check if authorized name is in soldBy or vice versa
        // (to handle cases like "Cocoblu" matching "Cocoblu Retail" and "Cocoblu Retail" matching "Cocoblu")
        return normalizedSoldBy.includes(authorized) || authorized.includes(normalizedSoldBy);
    });

    // 🚀 Super-permissive fallback for reporting clarity
    const permissiveMatch = normalizedSoldBy.includes('cocoblu') || 
                            normalizedSoldBy.includes('clicktech') || 
                            normalizedSoldBy.includes('retailez') ||
                            normalizedSoldBy.includes('appario');

    if (!result && permissiveMatch) {
        console.log(`[BuyBox Trace] Permissive Match Triggered | String: "${soldBy}"`);
        return true;
    }

    if (!result && normalizedSoldBy.includes('cocoblu')) {
        console.log(`[BuyBox Debug] Authorized: NO | String: "${soldBy}" | Normalized: "${normalizedSoldBy}"`);
    } else if (result) {
        console.log(`[BuyBox Debug] Authorized: YES | String: "${soldBy}"`);
    }

    return result || permissiveMatch;
}

module.exports = {
    OWN_SELLERS,
    isBuyBoxWinner
};
