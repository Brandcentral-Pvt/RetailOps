const controller = require('./backend/controllers/dashboardController');

const mockRes = {
    status: function (s) { this.statusCode = s; return this; },
    json: function (j) { console.log('JSON Output:', JSON.stringify(j)); return this; }
};

console.log('--- Testing with req.user = undefined ---');
try {
    controller.getDashboardData({ query: {} }, mockRes);
} catch (e) {
    console.log('Caught Error:', e.message);
}

console.log('--- Testing with req.user = { role: "admin" } ---');
try {
    controller.getDashboardData({ query: {}, user: { email: 'test@test.com', role: 'admin' } }, mockRes);
} catch (e) {
    console.log('Caught Error:', e.message);
}
