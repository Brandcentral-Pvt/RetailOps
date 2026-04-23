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
function isBuyBoxWinner(sellerName, configuredSellers = null) {
    if (!sellerName) return false;
    
    // Get configured sellers from env or database
    const trustedSellers = configuredSellers || (process.env.TRUSTED_SELLER_NAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    
    const sellerLower = sellerName.toLowerCase();
    
    // Check if seller is in trusted list
    const isTrusted = trustedSellers.some(trusted => 
        sellerLower.includes(trusted.toLowerCase()) || 
        trusted.toLowerCase().includes(sellerLower)
    );
    
    // Fallback to OWN_SELLERS if no trusted sellers configured
    if (trustedSellers.length === 0) {
        const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        const normalizedSoldBy = normalize(sellerName);
        const result = OWN_SELLERS.some(s => {
            const authorized = normalize(s);
            return normalizedSoldBy.includes(authorized) || authorized.includes(normalizedSoldBy);
        });
        return result;
    }
    
    return isTrusted;
}

module.exports = {
    OWN_SELLERS,
    isBuyBoxWinner
};
