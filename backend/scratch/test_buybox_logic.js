const OWN_SELLERS = [
    'Cocoblu Retail',
    'Cocblu Retail',
    'Cocoblu',
    'Cocblu',
    'Clicktech Retail Private Ltd',
    'RetailEZ Pvt Ltd',
    'ETrade Pvt Ltd'
];

function _isBuyBoxWinner(soldBy) {
    if (!soldBy) return false;
    
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedSoldBy = normalize(soldBy);
    
    return OWN_SELLERS.some(s => {
        const authorized = normalize(s);
        // Strictly check if the authorized name exists within the Amazon seller name
        return normalizedSoldBy.includes(authorized);
    });
}

const testCases = [
    { name: 'Cocoblu Retail', expected: true },
    { name: 'Cocoblu Retail India', expected: true },
    { name: 'cocoblu retail', expected: true },
    { name: 'CocobluRetail', expected: true },
    { name: 'Cocblu Retail', expected: true }, // User requested spelling
    { name: 'CocbluRetail', expected: true },
    { name: 'Clicktech Retail Private Ltd', expected: true },
    { name: 'RetailEZ Pvt Ltd', expected: true },
    { name: 'ETrade Pvt Ltd', expected: true },
    { name: 'Appario Retail Private Ltd', expected: false },
    { name: 'Other Seller', expected: false },
    { name: 'Cocoblu', expected: true }, // Should match because 'Cocoblu Retail' contains it? Wait...
    // Actually, 'normalize(s)' is 'cocobluretail'
    // 'normalize(soldBy)' is 'cocoblu'
    // 'cocoblu'.includes('cocobluretail') is false.
    // That's correct. We want the authorized name to be in the found name.
    { name: 'Cocoblu Retail - Delhi', expected: true },
    { name: 'COCOBLU RETAIL', expected: true }
];

console.log('--- BuyBox Logic Test ---');
testCases.forEach(tc => {
    const result = _isBuyBoxWinner(tc.name);
    console.log(`${tc.name.padEnd(30)} | Expected: ${tc.expected.toString().padEnd(6)} | Result: ${result.toString().padEnd(6)} | ${result === tc.expected ? '✅' : '❌'}`);
});
