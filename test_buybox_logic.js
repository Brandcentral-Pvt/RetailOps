const { isBuyBoxWinner } = require('./backend/utils/buyBoxUtils');

const testCases = [
    "Cocoblu Retail",
    "cocoblu retail",
    "COCOBLU RETAIL",
    "Cocblu Retail",
    "Cocoblu Retail Private Limited",
    "Sold by Cocoblu Retail",
    "Cocoblu Retail ",
    " Cocoblu Retail"
];

testCases.forEach(tc => {
    console.log(`Input: "${tc}" -> Winner: ${isBuyBoxWinner(tc)}`);
});
