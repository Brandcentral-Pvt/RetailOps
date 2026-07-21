const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const service = require('../services/pems/pemsService');

const TEMPLATES = [
  { id: '264dd85d76f84398b5d708b8', name: 'Optimize Product Listings' },
  { id: 'a5f1748d1a7641f3af84310f', name: 'Price & BuyBox Monitoring' },
  { id: 'e76dae238b92442fa9edce12', name: 'Inventory Health Check' },
  { id: 'e5daa5e2235943fa99fdba39', name: 'Sponsored Ads Weekly Review' },
  { id: '956d761c51ac429fad5df5c2', name: 'Competitor Analysis' },
  { id: '43a827557d3a4d0eb2f03a72', name: 'Returns Monitoring' },
  { id: '4f521631528f40b5a0092dbd', name: 'Brand Growth Plan' },
];

const SELLERS = [
  { id: '69e8612f1e4de9e2dc81f78d', name: '101-BHARVITA' },
  { id: '69e8612f1e4de9e2dc81f792', name: '106-NIREN ENTERPRISE' },
  { id: '69e861281e4de9e2dc81f6e3', name: '110-ROYALICA FASHION' },
  { id: '69e8612f1e4de9e2dc81f797', name: '117-FABRICON' },
  { id: '69e861321e4de9e2dc81f7cc', name: '120-NAVLIK' },
];

const USER = { id: 'b593e4f9abdf40b99bab1015', name: 'Akash Maurya' };

const STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'ASSIGNED', 'IN_PROGRESS', 'DRAFT', 'ASSIGNED', 'DRAFT'];

(async () => {
  for (let i = 0; i < TEMPLATES.length; i++) {
    const tpl = TEMPLATES[i];
    const seller = SELLERS[i % SELLERS.length];
    const status = STATUSES[i];

    const dueDate = new Date();
    if (status === 'IN_PROGRESS') {
      dueDate.setDate(dueDate.getDate() + 3);
    } else if (status === 'ASSIGNED') {
      dueDate.setDate(dueDate.getDate() + 7);
    } else {
      dueDate.setDate(dueDate.getDate() + 14);
    }

    try {
      const result = await service.createInstance({
        templateId: tpl.id,
        title: tpl.name,
        sellerId: seller.id,
        sellerName: seller.name,
        assignedTo: USER.id,
        assigneeName: USER.name,
        status: status,
        priority: i < 3 ? 'HIGH' : 'MEDIUM',
        frequency: tpl.name.includes('Daily') || tpl.name.includes('Returns') ? 'DAILY' :
                   tpl.name.includes('Growth') ? 'QUARTERLY' : 'WEEKLY',
        target: 50,
        slaHours: 48,
        dueDate: dueDate.toISOString(),
        createdBy: USER.id,
      });
      console.log(`✓ Created: ${tpl.name} → ${result.instanceCode} (${status})`);
    } catch (err) {
      console.error(`✗ Failed: ${tpl.name} — ${err.message}`);
    }
  }
  console.log('\nDone. Reload the page to see tasks.');
})();
