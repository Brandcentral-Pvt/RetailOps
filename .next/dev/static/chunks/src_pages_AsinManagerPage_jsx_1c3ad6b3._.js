(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/pages/AsinManagerPage.jsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$KPICard$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/KPICard.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$octoparseService$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/octoparseService.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/db.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$lqs$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/utils/lqs.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
// Helper function to generate week labels with date stamps
const generateWeekColumns = (history)=>{
    if (!history || history.length === 0) return [
        'W1'
    ];
    // Sort by date if available
    const sorted = [
        ...history
    ].sort((a, b)=>new Date(a.date) - new Date(b.date));
    return sorted.map((item, idx)=>{
        if (item.date) {
            const date = new Date(item.date);
            return `W${idx + 1}\n${date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short'
            })}`;
        }
        return `W${idx + 1}`;
    });
};
// Helper to get week label short format
const getWeekLabel = (week, index)=>{
    if (week.includes('\n')) {
        return week.split('\n')[0];
    }
    return week;
};
// Week columns for table headers
const WEEK_COLUMNS = [
    'W1',
    'W2',
    'W3',
    'W4',
    'W5',
    'W6',
    'W7',
    'W8'
];
// Helper function for week history badges
const getWeekHistoryBadge = (value, type)=>{
    if (!value && value !== 0) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        style: {
            color: '#9ca3af'
        },
        children: "-"
    }, void 0, false, {
        fileName: "[project]/src/pages/AsinManagerPage.jsx",
        lineNumber: 36,
        columnNumber: 37
    }, ("TURBOPACK compile-time value", void 0));
    if (type === 'price') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            style: {
                fontWeight: 500,
                color: '#059669'
            },
            children: [
                "₹",
                value.toLocaleString()
            ]
        }, void 0, true, {
            fileName: "[project]/src/pages/AsinManagerPage.jsx",
            lineNumber: 39,
            columnNumber: 12
        }, ("TURBOPACK compile-time value", void 0));
    } else if (type === 'number') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            style: {
                fontWeight: 500,
                color: '#2563eb'
            },
            children: [
                "#",
                value.toLocaleString()
            ]
        }, void 0, true, {
            fileName: "[project]/src/pages/AsinManagerPage.jsx",
            lineNumber: 41,
            columnNumber: 12
        }, ("TURBOPACK compile-time value", void 0));
    } else if (type === 'rating') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            style: {
                fontWeight: 500,
                color: '#d97706'
            },
            children: value.toFixed(1)
        }, void 0, false, {
            fileName: "[project]/src/pages/AsinManagerPage.jsx",
            lineNumber: 43,
            columnNumber: 12
        }, ("TURBOPACK compile-time value", void 0));
    }
    return value;
};
// Extended demo ASIN data with date stamps and 8 weeks of history
const demoAsins = [
    {
        id: '1',
        asinCode: 'B07XYZ123',
        sku: 'SKU-WE-001',
        title: 'Wireless Bluetooth Earbuds Pro with Noise Cancellation',
        imageUrl: 'https://placehold.co/100x100?text=Earbuds',
        brand: 'AudioTech',
        category: 'Electronics',
        currentPrice: 2499,
        currentRank: 1250,
        rating: 4.5,
        reviewCount: 1250,
        buyBoxWin: true,
        couponDetails: '₹100 Off',
        dealDetails: 'Lightning Deal',
        totalOffers: 15,
        imagesCount: 7,
        hasAPlus: true,
        descLength: 520,
        lqs: 85,
        status: 'Active',
        weekHistory: [
            {
                week: 'Week 1',
                date: '2024-12-01',
                price: 2399,
                bsr: 1400,
                rating: 4.4,
                reviews: 1180
            },
            {
                week: 'Week 2',
                date: '2024-12-08',
                price: 2499,
                bsr: 1350,
                rating: 4.4,
                reviews: 1200
            },
            {
                week: 'Week 3',
                date: '2024-12-15',
                price: 2499,
                bsr: 1300,
                rating: 4.5,
                reviews: 1215
            },
            {
                week: 'Week 4',
                date: '2024-12-22',
                price: 2599,
                bsr: 1280,
                rating: 4.5,
                reviews: 1225
            },
            {
                week: 'Week 5',
                date: '2024-12-29',
                price: 2499,
                bsr: 1250,
                rating: 4.5,
                reviews: 1235
            },
            {
                week: 'Week 6',
                date: '2025-01-05',
                price: 2399,
                bsr: 1220,
                rating: 4.5,
                reviews: 1240
            },
            {
                week: 'Week 7',
                date: '2025-01-12',
                price: 2499,
                bsr: 1200,
                rating: 4.5,
                reviews: 1245
            },
            {
                week: 'Week 8',
                date: '2025-01-19',
                price: 2499,
                bsr: 1250,
                rating: 4.5,
                reviews: 1250
            }
        ]
    },
    {
        id: '2',
        asinCode: 'B07ABC456',
        sku: 'SKU-SW-002',
        title: 'Smart Watch Elite - Fitness Tracker with GPS',
        imageUrl: 'https://placehold.co/100x100?text=Watch',
        brand: 'FitGear',
        category: 'Electronics',
        currentPrice: 8999,
        currentRank: 890,
        rating: 4.2,
        reviewCount: 890,
        buyBoxWin: true,
        couponDetails: 'None',
        dealDetails: 'None',
        totalOffers: 8,
        imagesCount: 5,
        hasAPlus: true,
        descLength: 480,
        lqs: 72,
        status: 'Active',
        weekHistory: [
            {
                week: 'Week 1',
                date: '2024-12-01',
                price: 8799,
                bsr: 950,
                rating: 4.1,
                reviews: 820
            },
            {
                week: 'Week 2',
                date: '2024-12-08',
                price: 8999,
                bsr: 920,
                rating: 4.1,
                reviews: 835
            },
            {
                week: 'Week 3',
                date: '2024-12-15',
                price: 9199,
                bsr: 900,
                rating: 4.2,
                reviews: 850
            },
            {
                week: 'Week 4',
                date: '2024-12-22',
                price: 8999,
                bsr: 910,
                rating: 4.2,
                reviews: 860
            },
            {
                week: 'Week 5',
                date: '2024-12-29',
                price: 8799,
                bsr: 895,
                rating: 4.2,
                reviews: 870
            },
            {
                week: 'Week 6',
                date: '2025-01-05',
                price: 8999,
                bsr: 890,
                rating: 4.2,
                reviews: 880
            },
            {
                week: 'Week 7',
                date: '2025-01-12',
                price: 9199,
                bsr: 885,
                rating: 4.2,
                reviews: 885
            },
            {
                week: 'Week 8',
                date: '2025-01-19',
                price: 8999,
                bsr: 890,
                rating: 4.2,
                reviews: 890
            }
        ]
    },
    {
        id: '3',
        asinCode: 'B07DEF789',
        sku: 'SKU-YM-003',
        title: 'Premium Yoga Mat - Non-Slip Exercise Mat',
        imageUrl: 'https://placehold.co/100x100?text=Yoga',
        brand: 'FitLife',
        category: 'Sports',
        currentPrice: 1299,
        currentRank: 3200,
        rating: 4.8,
        reviewCount: 3200,
        buyBoxWin: true,
        couponDetails: '₹50 Off',
        dealDetails: 'None',
        totalOffers: 22,
        imagesCount: 6,
        hasAPlus: false,
        descLength: 280,
        lqs: 68,
        status: 'Active',
        weekHistory: [
            {
                week: 'Week 1',
                date: '2024-12-01',
                price: 1199,
                bsr: 3500,
                rating: 4.7,
                reviews: 3050
            },
            {
                week: 'Week 2',
                date: '2024-12-08',
                price: 1299,
                bsr: 3400,
                rating: 4.7,
                reviews: 3080
            },
            {
                week: 'Week 3',
                date: '2024-12-15',
                price: 1299,
                bsr: 3350,
                rating: 4.7,
                reviews: 3100
            },
            {
                week: 'Week 4',
                date: '2024-12-22',
                price: 1399,
                bsr: 3300,
                rating: 4.7,
                reviews: 3120
            },
            {
                week: 'Week 5',
                date: '2024-12-29',
                price: 1299,
                bsr: 3250,
                rating: 4.8,
                reviews: 3140
            },
            {
                week: 'Week 6',
                date: '2025-01-05',
                price: 1199,
                bsr: 3220,
                rating: 4.8,
                reviews: 3160
            },
            {
                week: 'Week 7',
                date: '2025-01-12',
                price: 1299,
                bsr: 3210,
                rating: 4.8,
                reviews: 3180
            },
            {
                week: 'Week 8',
                date: '2025-01-19',
                price: 1299,
                bsr: 3200,
                rating: 4.8,
                reviews: 3200
            }
        ]
    },
    {
        id: '4',
        asinCode: 'B07GHI012',
        sku: 'SKU-KT-004',
        title: 'Kitchen Scale Digital - Precision Food Scale',
        imageUrl: 'https://placehold.co/100x100?text=Scale',
        brand: 'HomeChef',
        category: 'Home & Kitchen',
        currentPrice: 799,
        currentRank: 4500,
        rating: 4.3,
        reviewCount: 4500,
        buyBoxWin: false,
        couponDetails: 'None',
        dealDetails: 'None',
        totalOffers: 35,
        imagesCount: 8,
        hasAPlus: true,
        descLength: 420,
        lqs: 78,
        status: 'Active',
        weekHistory: [
            {
                week: 'Week 1',
                date: '2024-12-01',
                price: 699,
                bsr: 4800,
                rating: 4.2,
                reviews: 4300
            },
            {
                week: 'Week 2',
                date: '2024-12-08',
                price: 799,
                bsr: 4700,
                rating: 4.2,
                reviews: 4350
            },
            {
                week: 'Week 3',
                date: '2024-12-15',
                price: 849,
                bsr: 4650,
                rating: 4.3,
                reviews: 4400
            },
            {
                week: 'Week 4',
                date: '2024-12-22',
                price: 799,
                bsr: 4600,
                rating: 4.3,
                reviews: 4420
            },
            {
                week: 'Week 5',
                date: '2024-12-29',
                price: 749,
                bsr: 4550,
                rating: 4.3,
                reviews: 4440
            },
            {
                week: 'Week 6',
                date: '2025-01-05',
                price: 799,
                bsr: 4520,
                rating: 4.3,
                reviews: 4460
            },
            {
                week: 'Week 7',
                date: '2025-01-12',
                price: 849,
                bsr: 4510,
                rating: 4.3,
                reviews: 4480
            },
            {
                week: 'Week 8',
                date: '2025-01-19',
                price: 799,
                bsr: 4500,
                rating: 4.3,
                reviews: 4500
            }
        ]
    },
    {
        id: '5',
        asinCode: 'B07JKL345',
        sku: 'SKU-SP-005',
        title: 'Security Camera 1080P - Wireless Home Security',
        imageUrl: 'https://placehold.co/100x100?text=Camera',
        brand: 'SecureHome',
        category: 'Electronics',
        currentPrice: 3499,
        currentRank: 1850,
        rating: 4.1,
        reviewCount: 1850,
        buyBoxWin: true,
        couponDetails: '₹200 Off',
        dealDetails: 'Prime Deal',
        totalOffers: 12,
        imagesCount: 9,
        hasAPlus: true,
        descLength: 680,
        lqs: 82,
        status: 'Active',
        weekHistory: [
            {
                week: 'Week 1',
                date: '2024-12-01',
                price: 3299,
                bsr: 2000,
                rating: 4.0,
                reviews: 1750
            },
            {
                week: 'Week 2',
                date: '2024-12-08',
                price: 3499,
                bsr: 1950,
                rating: 4.0,
                reviews: 1770
            },
            {
                week: 'Week 3',
                date: '2024-12-15',
                price: 3699,
                bsr: 1900,
                rating: 4.1,
                reviews: 1790
            },
            {
                week: 'Week 4',
                date: '2024-12-22',
                price: 3499,
                bsr: 1880,
                rating: 4.1,
                reviews: 1805
            },
            {
                week: 'Week 5',
                date: '2024-12-29',
                price: 3299,
                bsr: 1860,
                rating: 4.1,
                reviews: 1820
            },
            {
                week: 'Week 6',
                date: '2025-01-05',
                price: 3499,
                bsr: 1855,
                rating: 4.1,
                reviews: 1830
            },
            {
                week: 'Week 7',
                date: '2025-01-12',
                price: 3699,
                bsr: 1852,
                rating: 4.1,
                reviews: 1840
            },
            {
                week: 'Week 8',
                date: '2025-01-19',
                price: 3499,
                bsr: 1850,
                rating: 4.1,
                reviews: 1850
            }
        ]
    }
];
const AsinManagerPage = ()=>{
    _s();
    const [asins, setAsins] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [showDashboard, setShowDashboard] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [showTable, setShowTable] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [newAsin, setNewAsin] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [syncing, setSyncing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [showAddModal, setShowAddModal] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AsinManagerPage.useEffect": ()=>{
            const loadData = {
                "AsinManagerPage.useEffect.loadData": async ()=>{
                    try {
                        setLoading(true);
                        // Use db service instead of raw fetch
                        const asinsData = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].getAsins(); // Ensure this method exists in db.js
                        if (asinsData && asinsData.length > 0) {
                            setAsins(asinsData);
                            setError(null);
                        } else {
                            console.warn('No ASINs returned or empty, checking for demo fallback');
                            // Optional: Only fallback if explicitly desired, otherwise empty state
                            // setAsins(demoAsins); 
                            setAsins([]);
                        }
                    } catch (err) {
                        console.error('Error fetching ASINs:', err);
                        setError(err.message);
                        setAsins(demoAsins); // Fallback to demo data on error for now
                    } finally{
                        setLoading(false);
                    }
                }
            }["AsinManagerPage.useEffect.loadData"];
            loadData();
        }
    }["AsinManagerPage.useEffect"], []);
    const kpis = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AsinManagerPage.useMemo[kpis]": ()=>{
            const avgLqs = asins.length > 0 ? Math.round(asins.reduce({
                "AsinManagerPage.useMemo[kpis]": (sum, a)=>sum + a.lqs
            }["AsinManagerPage.useMemo[kpis]"], 0) / asins.length) : 0;
            const buyBoxWins = asins.filter({
                "AsinManagerPage.useMemo[kpis]": (a)=>a.buyBoxWin
            }["AsinManagerPage.useMemo[kpis]"]).length;
            const lowLqs = asins.filter({
                "AsinManagerPage.useMemo[kpis]": (a)=>a.lqs < 70
            }["AsinManagerPage.useMemo[kpis]"]).length;
            const activeDeals = asins.filter({
                "AsinManagerPage.useMemo[kpis]": (a)=>a.dealDetails !== 'None'
            }["AsinManagerPage.useMemo[kpis]"]).length;
            const avgPrice = asins.length > 0 ? Math.round(asins.reduce({
                "AsinManagerPage.useMemo[kpis]": (sum, a)=>sum + a.currentPrice
            }["AsinManagerPage.useMemo[kpis]"], 0) / asins.length) : 0;
            const avgBSR = asins.length > 0 ? Math.round(asins.reduce({
                "AsinManagerPage.useMemo[kpis]": (sum, a)=>sum + a.currentRank
            }["AsinManagerPage.useMemo[kpis]"], 0) / asins.length) : 0;
            return [
                {
                    title: 'Total ASINs',
                    value: asins.length.toString(),
                    icon: 'bi-box-seam',
                    trend: asins.length,
                    trendType: 'neutral'
                },
                {
                    title: 'Avg LQS Score',
                    value: avgLqs + '%',
                    icon: 'bi-graph-up',
                    trend: 3,
                    trendType: avgLqs >= 70 ? 'positive' : 'negative'
                },
                {
                    title: 'Buy Box Rate',
                    value: asins.length > 0 ? Math.round(buyBoxWins / asins.length * 100) + '%' : '0%',
                    icon: 'bi-trophy',
                    trend: 5,
                    trendType: 'positive'
                },
                {
                    title: 'Low LQS Items',
                    value: lowLqs.toString(),
                    icon: 'bi-exclamation-triangle',
                    trend: lowLqs,
                    trendType: lowLqs > 0 ? 'negative' : 'positive'
                },
                {
                    title: 'Active Deals',
                    value: activeDeals.toString(),
                    icon: 'bi-lightning',
                    trend: activeDeals,
                    trendType: 'neutral'
                },
                {
                    title: 'Avg Price',
                    value: '₹' + avgPrice.toLocaleString(),
                    icon: 'bi-currency-rupee',
                    trend: 0,
                    trendType: 'neutral'
                },
                {
                    title: 'Avg BSR',
                    value: '#' + avgBSR.toLocaleString(),
                    icon: 'bi-bar-chart',
                    trend: 0,
                    trendType: 'neutral'
                },
                {
                    title: 'Total Reviews',
                    value: asins.reduce({
                        "AsinManagerPage.useMemo[kpis]": (sum, a)=>sum + a.reviewCount
                    }["AsinManagerPage.useMemo[kpis]"], 0).toLocaleString(),
                    icon: 'bi-star',
                    trend: 150,
                    trendType: 'positive'
                }
            ];
        }
    }["AsinManagerPage.useMemo[kpis]"], [
        asins
    ]);
    const weekColumns = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AsinManagerPage.useMemo[weekColumns]": ()=>{
            if (asins.length > 0 && asins[0]?.weekHistory) {
                return generateWeekColumns(asins[0].weekHistory);
            }
            return [
                'W1'
            ];
        }
    }["AsinManagerPage.useMemo[weekColumns]"], [
        asins
    ]);
    const handleSync = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AsinManagerPage.useCallback[handleSync]": async ()=>{
            if (!newAsin.trim()) {
                alert('Please enter at least one ASIN');
                return;
            }
            setSyncing(true);
            try {
                const asinList = newAsin.split(',').map({
                    "AsinManagerPage.useCallback[handleSync].asinList": (a)=>a.trim()
                }["AsinManagerPage.useCallback[handleSync].asinList"]).filter({
                    "AsinManagerPage.useCallback[handleSync].asinList": (a)=>a.length > 0
                }["AsinManagerPage.useCallback[handleSync].asinList"]);
                const result = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$octoparseService$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].syncAsins(asinList);
                const newAsinsData = asinList.map({
                    "AsinManagerPage.useCallback[handleSync].newAsinsData": (asinCode)=>({
                            id: String(Date.now()) + Math.random(),
                            asinCode,
                            title: 'Scraping in progress...',
                            imageUrl: 'https://placehold.co/100x100?text=Scraping',
                            brand: 'Pending',
                            category: 'Pending',
                            currentPrice: 0,
                            currentRank: 0,
                            rating: 0,
                            reviewCount: 0,
                            buyBoxWin: false,
                            couponDetails: 'None',
                            dealDetails: 'None',
                            totalOffers: 0,
                            imagesCount: 0,
                            hasAPlus: false,
                            descLength: 0,
                            lqs: 0,
                            status: 'Scraping',
                            weekHistory: weekColumns.map({
                                "AsinManagerPage.useCallback[handleSync].newAsinsData": (week, idx)=>({
                                        week: getWeekLabel(week, idx),
                                        date: null,
                                        price: 0,
                                        bsr: 0,
                                        rating: 0,
                                        reviews: 0
                                    })
                            }["AsinManagerPage.useCallback[handleSync].newAsinsData"]),
                            executionId: result.executionId
                        })
                }["AsinManagerPage.useCallback[handleSync].newAsinsData"]);
                setAsins({
                    "AsinManagerPage.useCallback[handleSync]": (prev)=>[
                            ...prev,
                            ...newAsinsData
                        ]
                }["AsinManagerPage.useCallback[handleSync]"]);
                setNewAsin('');
                setShowAddModal(false);
                alert(`Scraping started for ${asinList.length} ASIN(s). Check Scrape Tasks page for progress.`);
            } catch (error) {
                console.error('Sync failed:', error);
                alert('Failed to start scraping: ' + error.message);
            } finally{
                setSyncing(false);
            }
        }
    }["AsinManagerPage.useCallback[handleSync]"], [
        newAsin,
        weekColumns
    ]);
    const getLqsBadge = (lqs)=>{
        let bgColor = '#059669';
        let textColor = '#fff';
        if (lqs < 60) {
            bgColor = '#dc2626';
        } else if (lqs < 80) {
            bgColor = '#d97706';
        }
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "badge",
            style: {
                backgroundColor: bgColor,
                color: textColor,
                fontWeight: 600,
                fontSize: '0.75rem'
            },
            children: lqs
        }, void 0, false, {
            fileName: "[project]/src/pages/AsinManagerPage.jsx",
            lineNumber: 338,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    };
    const getBuyBoxBadge = (buyBoxWin)=>{
        const bgColor = buyBoxWin ? '#059669' : '#6b7280';
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "badge",
            style: {
                backgroundColor: bgColor,
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.75rem'
            },
            children: buyBoxWin ? 'Won' : 'Lost'
        }, void 0, false, {
            fileName: "[project]/src/pages/AsinManagerPage.jsx",
            lineNumber: 350,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    };
    const getAplusBadge = (hasAPlus)=>{
        const bgColor = hasAPlus ? '#059669' : '#6b7280';
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "badge",
            style: {
                backgroundColor: bgColor,
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.75rem'
            },
            children: hasAPlus ? 'Yes' : 'No'
        }, void 0, false, {
            fileName: "[project]/src/pages/AsinManagerPage.jsx",
            lineNumber: 362,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    };
    const getStatusBadge = (status)=>{
        const bgColor = status === 'Active' ? '#059669' : '#d97706';
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "badge",
            style: {
                backgroundColor: bgColor,
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.75rem'
            },
            children: status
        }, void 0, false, {
            fileName: "[project]/src/pages/AsinManagerPage.jsx",
            lineNumber: 374,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    };
    // Collapsible Section Component
    const CollapsibleSection = ({ title, icon, isOpen, onToggle, children, badge })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "card mb-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "card-header d-flex justify-content-between align-items-center cursor-pointer",
                    onClick: onToggle,
                    style: {
                        cursor: 'pointer',
                        backgroundColor: '#f9fafb',
                        borderBottom: '1px solid #e5e7eb'
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h5", {
                            className: "card-title mb-0",
                            style: {
                                color: '#111827',
                                fontWeight: 600
                            },
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                    className: `${icon} me-2`,
                                    style: {
                                        color: '#4f46e5'
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                    lineNumber: 392,
                                    columnNumber: 11
                                }, ("TURBOPACK compile-time value", void 0)),
                                title,
                                badge && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "badge ms-2",
                                    style: {
                                        backgroundColor: '#4f46e5',
                                        color: '#fff'
                                    },
                                    children: badge
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                    lineNumber: 394,
                                    columnNumber: 21
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                            lineNumber: 391,
                            columnNumber: 9
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            className: "btn btn-sm",
                            style: {
                                backgroundColor: '#fff',
                                border: '1px solid #d1d5db',
                                color: '#374151'
                            },
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                className: `bi ${isOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`
                            }, void 0, false, {
                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                lineNumber: 397,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                            lineNumber: 396,
                            columnNumber: 9
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                    lineNumber: 386,
                    columnNumber: 7
                }, ("TURBOPACK compile-time value", void 0)),
                isOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "card-body",
                    style: {
                        backgroundColor: '#fff',
                        padding: '1rem'
                    },
                    children: children
                }, void 0, false, {
                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                    lineNumber: 400,
                    columnNumber: 18
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/src/pages/AsinManagerPage.jsx",
            lineNumber: 385,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0));
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                    className: "main-header",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "page-title",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                className: "bi bi-upc-scan"
                            }, void 0, false, {
                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                lineNumber: 408,
                                columnNumber: 38
                            }, ("TURBOPACK compile-time value", void 0)),
                            "ASIN Manager"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                        lineNumber: 408,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                }, void 0, false, {
                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                    lineNumber: 407,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "page-content",
                    children: error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "alert alert-warning",
                        role: "alert",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                className: "bi bi-exclamation-triangle me-2"
                            }, void 0, false, {
                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                lineNumber: 413,
                                columnNumber: 15
                            }, ("TURBOPACK compile-time value", void 0)),
                            error,
                            " - Showing demo data"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                        lineNumber: 412,
                        columnNumber: 13
                    }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "d-flex justify-content-center align-items-center",
                        style: {
                            minHeight: '400px'
                        },
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "loading-spinner"
                        }, void 0, false, {
                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                            lineNumber: 418,
                            columnNumber: 15
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                        lineNumber: 417,
                        columnNumber: 13
                    }, ("TURBOPACK compile-time value", void 0))
                }, void 0, false, {
                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                    lineNumber: 410,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "main-header",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "d-flex justify-content-between align-items-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            className: "page-title",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                    className: "bi bi-upc-scan"
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                    lineNumber: 430,
                                    columnNumber: 38
                                }, ("TURBOPACK compile-time value", void 0)),
                                "ASIN Manager"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                            lineNumber: 430,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            className: "btn btn-primary",
                            onClick: ()=>setShowAddModal(true),
                            style: {
                                fontWeight: 500
                            },
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                    className: "bi bi-plus-lg me-2"
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                    lineNumber: 432,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                "Add ASIN"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                            lineNumber: 431,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                    lineNumber: 429,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                lineNumber: 428,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "page-content",
                children: [
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "alert alert-warning d-flex align-items-center mb-3",
                        role: "alert",
                        style: {
                            padding: '0.75rem 1rem'
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                className: "bi bi-exclamation-triangle me-2"
                            }, void 0, false, {
                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                lineNumber: 440,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Unable to connect to database. Showing demo data."
                            }, void 0, false, {
                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                lineNumber: 441,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                        lineNumber: 439,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CollapsibleSection, {
                        title: "ASIN Performance Overview",
                        icon: "bi bi-graph-up",
                        isOpen: showDashboard,
                        onToggle: ()=>setShowDashboard(!showDashboard),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "kpi-grid mb-4",
                                children: kpis.map((kpi, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$KPICard$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                        title: kpi.title,
                                        value: kpi.value,
                                        icon: kpi.icon,
                                        trend: kpi.trend,
                                        trendType: kpi.trendType
                                    }, idx, false, {
                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                        lineNumber: 455,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0)))
                            }, void 0, false, {
                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                lineNumber: 453,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "row mb-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "col-lg-4",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "card h-100",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "card-header",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h6", {
                                                        className: "mb-0",
                                                        children: "Price Analysis"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                        lineNumber: 464,
                                                        columnNumber: 19
                                                    }, ("TURBOPACK compile-time value", void 0))
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                    lineNumber: 463,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "card-body",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mb-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                    children: "Average Price:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 467,
                                                                    columnNumber: 39
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                " ₹",
                                                                Math.round(asins.reduce((sum, a)=>sum + a.currentPrice, 0) / asins.length).toLocaleString()
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 467,
                                                            columnNumber: 19
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mb-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                    children: "Highest Price:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 468,
                                                                    columnNumber: 39
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                " ₹",
                                                                Math.max(...asins.map((a)=>a.currentPrice)).toLocaleString()
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 468,
                                                            columnNumber: 19
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mb-0",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                    children: "Lowest Price:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 469,
                                                                    columnNumber: 39
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                " ₹",
                                                                Math.min(...asins.map((a)=>a.currentPrice)).toLocaleString()
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 469,
                                                            columnNumber: 19
                                                        }, ("TURBOPACK compile-time value", void 0))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                    lineNumber: 466,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                            lineNumber: 462,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                        lineNumber: 461,
                                        columnNumber: 13
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "col-lg-4",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "card h-100",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "card-header",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h6", {
                                                        className: "mb-0",
                                                        children: "BSR Analysis"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                        lineNumber: 476,
                                                        columnNumber: 19
                                                    }, ("TURBOPACK compile-time value", void 0))
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                    lineNumber: 475,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "card-body",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mb-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                    children: "Average BSR:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 479,
                                                                    columnNumber: 39
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                " #",
                                                                Math.round(asins.reduce((sum, a)=>sum + a.currentRank, 0) / asins.length).toLocaleString()
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 479,
                                                            columnNumber: 19
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mb-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                    children: "Best BSR:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 480,
                                                                    columnNumber: 39
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                " #",
                                                                Math.min(...asins.map((a)=>a.currentRank)).toLocaleString()
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 480,
                                                            columnNumber: 19
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mb-0",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                    children: "Products:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 481,
                                                                    columnNumber: 39
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                " ",
                                                                asins.length,
                                                                " ASINs"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 481,
                                                            columnNumber: 19
                                                        }, ("TURBOPACK compile-time value", void 0))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                    lineNumber: 478,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                            lineNumber: 474,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                        lineNumber: 473,
                                        columnNumber: 13
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "col-lg-4",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "card h-100",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "card-header",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h6", {
                                                        className: "mb-0",
                                                        children: "Content & Optimization"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                        lineNumber: 488,
                                                        columnNumber: 19
                                                    }, ("TURBOPACK compile-time value", void 0))
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                    lineNumber: 487,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "card-body",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mb-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                    children: "A+ Content:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 491,
                                                                    columnNumber: 39
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                " ",
                                                                asins.filter((a)=>a.hasAPlus).length,
                                                                " / ",
                                                                asins.length
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 491,
                                                            columnNumber: 19
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mb-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                    children: "Avg Description:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 492,
                                                                    columnNumber: 39
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                " ",
                                                                Math.round(asins.reduce((sum, a)=>sum + a.descLength, 0) / asins.length),
                                                                " chars"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 492,
                                                            columnNumber: 19
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mb-0",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                    children: "Avg Images:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 493,
                                                                    columnNumber: 39
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                " ",
                                                                Math.round(asins.reduce((sum, a)=>sum + a.imagesCount, 0) / asins.length)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 493,
                                                            columnNumber: 19
                                                        }, ("TURBOPACK compile-time value", void 0))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                    lineNumber: 490,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                            lineNumber: 486,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                        lineNumber: 485,
                                        columnNumber: 13
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                lineNumber: 460,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                        lineNumber: 446,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "card",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "card-header d-flex justify-content-between align-items-center",
                                style: {
                                    backgroundColor: '#f9fafb',
                                    borderBottom: '1px solid #e5e7eb'
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h5", {
                                        className: "card-title mb-0",
                                        style: {
                                            color: '#111827',
                                            fontWeight: 600
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                                className: "bi bi-table me-2",
                                                style: {
                                                    color: '#4f46e5'
                                                }
                                            }, void 0, false, {
                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                lineNumber: 504,
                                                columnNumber: 15
                                            }, ("TURBOPACK compile-time value", void 0)),
                                            "ASIN Data Table",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "badge ms-2",
                                                style: {
                                                    backgroundColor: '#4f46e5',
                                                    color: '#fff'
                                                },
                                                children: asins.length
                                            }, void 0, false, {
                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                lineNumber: 506,
                                                columnNumber: 15
                                            }, ("TURBOPACK compile-time value", void 0))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                        lineNumber: 503,
                                        columnNumber: 13
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        className: "btn btn-sm",
                                        style: {
                                            backgroundColor: '#fff',
                                            border: '1px solid #d1d5db',
                                            color: '#374151'
                                        },
                                        onClick: ()=>setShowTable(!showTable),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                            className: `bi ${showTable ? 'bi-chevron-up' : 'bi-chevron-down'}`
                                        }, void 0, false, {
                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                            lineNumber: 513,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                        lineNumber: 508,
                                        columnNumber: 13
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                lineNumber: 502,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            showTable && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "card-body",
                                style: {
                                    backgroundColor: '#fff',
                                    padding: 0
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "d-flex justify-content-end gap-2 p-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                className: "btn btn-outline-primary btn-sm",
                                                onClick: ()=>console.log('Export CSV'),
                                                style: {
                                                    fontWeight: 500
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                                        className: "bi bi-download me-1"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                        lineNumber: 520,
                                                        columnNumber: 19
                                                    }, ("TURBOPACK compile-time value", void 0)),
                                                    "Export CSV"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                lineNumber: 519,
                                                columnNumber: 17
                                            }, ("TURBOPACK compile-time value", void 0)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                className: "btn btn-outline-secondary btn-sm",
                                                onClick: ()=>console.log('Sync All'),
                                                style: {
                                                    fontWeight: 500
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                                        className: "bi bi-arrow-repeat me-1"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                        lineNumber: 523,
                                                        columnNumber: 19
                                                    }, ("TURBOPACK compile-time value", void 0)),
                                                    "Sync All"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                lineNumber: 522,
                                                columnNumber: 17
                                            }, ("TURBOPACK compile-time value", void 0))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                        lineNumber: 518,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            overflowX: 'auto'
                                        },
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                            className: "table table-hover mb-0",
                                            style: {
                                                fontSize: '0.8rem',
                                                minWidth: '1200px'
                                            },
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                                    style: {
                                                        position: 'sticky',
                                                        top: 0,
                                                        backgroundColor: '#f9fafb',
                                                        zIndex: 10
                                                    },
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem'
                                                                    },
                                                                    children: "ASIN"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 532,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem'
                                                                    },
                                                                    children: "SKU"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 533,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem',
                                                                        minWidth: '180px'
                                                                    },
                                                                    children: "Product"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 534,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem'
                                                                    },
                                                                    children: "Price"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 535,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    colSpan: "8",
                                                                    style: {
                                                                        backgroundColor: '#e0e7ff',
                                                                        color: '#3730a3',
                                                                        fontWeight: 600,
                                                                        textAlign: 'center',
                                                                        padding: '0.5rem',
                                                                        borderBottom: '2px solid #c7d2fe'
                                                                    },
                                                                    children: "Price by Week"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 536,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem'
                                                                    },
                                                                    children: "BSR"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 537,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    colSpan: "8",
                                                                    style: {
                                                                        backgroundColor: '#dcfce7',
                                                                        color: '#166534',
                                                                        fontWeight: 600,
                                                                        textAlign: 'center',
                                                                        padding: '0.5rem',
                                                                        borderBottom: '2px solid #bbf7d0'
                                                                    },
                                                                    children: "BSR by Week"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 538,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem'
                                                                    },
                                                                    children: "Rating"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 539,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    colSpan: "8",
                                                                    style: {
                                                                        backgroundColor: '#fef3c7',
                                                                        color: '#92400e',
                                                                        fontWeight: 600,
                                                                        textAlign: 'center',
                                                                        padding: '0.5rem',
                                                                        borderBottom: '2px solid #fde68a'
                                                                    },
                                                                    children: "Rating by Week"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 540,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem'
                                                                    },
                                                                    children: "Reviews"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 541,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem'
                                                                    },
                                                                    children: "LQS"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 542,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem'
                                                                    },
                                                                    children: "Buy Box"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 543,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem'
                                                                    },
                                                                    children: "A+"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 544,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem'
                                                                    },
                                                                    children: "Images"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 545,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem'
                                                                    },
                                                                    children: "Desc Len"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 546,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    rowSpan: "2",
                                                                    style: {
                                                                        verticalAlign: 'middle',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#111827',
                                                                        fontWeight: 600,
                                                                        borderBottom: '2px solid #d1d5db',
                                                                        padding: '0.75rem 0.5rem'
                                                                    },
                                                                    children: "Status"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 547,
                                                                    columnNumber: 23
                                                                }, ("TURBOPACK compile-time value", void 0))
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 531,
                                                            columnNumber: 21
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                            children: [
                                                                weekColumns.map((week)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        style: {
                                                                            backgroundColor: '#e0e7ff',
                                                                            color: '#3730a3',
                                                                            fontWeight: 500,
                                                                            fontSize: '0.7rem',
                                                                            padding: '0.5rem 0.25rem',
                                                                            border: '1px solid #c7d2fe'
                                                                        },
                                                                        children: week
                                                                    }, `price-${week}`, false, {
                                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                        lineNumber: 552,
                                                                        columnNumber: 25
                                                                    }, ("TURBOPACK compile-time value", void 0))),
                                                                weekColumns.map((week)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        style: {
                                                                            backgroundColor: '#dcfce7',
                                                                            color: '#166534',
                                                                            fontWeight: 500,
                                                                            fontSize: '0.7rem',
                                                                            padding: '0.5rem 0.25rem',
                                                                            border: '1px solid #bbf7d0'
                                                                        },
                                                                        children: week
                                                                    }, `bsr-${week}`, false, {
                                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                        lineNumber: 556,
                                                                        columnNumber: 25
                                                                    }, ("TURBOPACK compile-time value", void 0))),
                                                                weekColumns.map((week)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        style: {
                                                                            backgroundColor: '#fef3c7',
                                                                            color: '#92400e',
                                                                            fontWeight: 500,
                                                                            fontSize: '0.7rem',
                                                                            padding: '0.5rem 0.25rem',
                                                                            border: '1px solid #fde68a'
                                                                        },
                                                                        children: week
                                                                    }, `rating-${week}`, false, {
                                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                        lineNumber: 560,
                                                                        columnNumber: 25
                                                                    }, ("TURBOPACK compile-time value", void 0)))
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 549,
                                                            columnNumber: 21
                                                        }, ("TURBOPACK compile-time value", void 0))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                    lineNumber: 530,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                                    children: asins.map((asin)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                            style: {
                                                                backgroundColor: '#fff'
                                                            },
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        fontWeight: 600,
                                                                        color: '#111827',
                                                                        padding: '0.75rem 0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: asin.asinCode
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 567,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        color: '#4b5563',
                                                                        padding: '0.75rem 0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: asin.sku
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 568,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        padding: '0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "d-flex align-items-center gap-2",
                                                                        style: {
                                                                            maxWidth: '180px'
                                                                        },
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                                src: asin.imageUrl,
                                                                                alt: asin.title,
                                                                                style: {
                                                                                    width: '32px',
                                                                                    height: '32px',
                                                                                    borderRadius: '4px',
                                                                                    objectFit: 'cover'
                                                                                }
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                                lineNumber: 571,
                                                                                columnNumber: 29
                                                                            }, ("TURBOPACK compile-time value", void 0)),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                style: {
                                                                                    overflow: 'hidden',
                                                                                    textOverflow: 'ellipsis',
                                                                                    whiteSpace: 'nowrap',
                                                                                    display: 'block'
                                                                                },
                                                                                children: asin.title
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                                lineNumber: 572,
                                                                                columnNumber: 29
                                                                            }, ("TURBOPACK compile-time value", void 0))
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                        lineNumber: 570,
                                                                        columnNumber: 27
                                                                    }, ("TURBOPACK compile-time value", void 0))
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 569,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        fontWeight: 600,
                                                                        color: '#059669',
                                                                        padding: '0.75rem 0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: [
                                                                        "₹",
                                                                        asin.currentPrice?.toLocaleString()
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 582,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                asin.weekHistory?.map((week, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        style: {
                                                                            backgroundColor: '#f5f3ff',
                                                                            padding: '0.5rem 0.25rem',
                                                                            border: '1px solid #e5e7eb',
                                                                            textAlign: 'center'
                                                                        },
                                                                        children: getWeekHistoryBadge(week.price, 'price')
                                                                    }, `price-${idx}`, false, {
                                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                        lineNumber: 587,
                                                                        columnNumber: 27
                                                                    }, ("TURBOPACK compile-time value", void 0))),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        fontWeight: 600,
                                                                        color: '#2563eb',
                                                                        padding: '0.75rem 0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: [
                                                                        "#",
                                                                        asin.currentRank?.toLocaleString()
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 591,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                asin.weekHistory?.map((week, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        style: {
                                                                            backgroundColor: '#f0fdf4',
                                                                            padding: '0.5rem 0.25rem',
                                                                            border: '1px solid #e5e7eb',
                                                                            textAlign: 'center'
                                                                        },
                                                                        children: getWeekHistoryBadge(week.bsr, 'number')
                                                                    }, `bsr-${idx}`, false, {
                                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                        lineNumber: 596,
                                                                        columnNumber: 27
                                                                    }, ("TURBOPACK compile-time value", void 0))),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        padding: '0.75rem 0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "d-flex align-items-center gap-1",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                                                                className: "bi bi-star-fill text-warning",
                                                                                style: {
                                                                                    fontSize: '0.75rem'
                                                                                }
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                                lineNumber: 602,
                                                                                columnNumber: 29
                                                                            }, ("TURBOPACK compile-time value", void 0)),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                style: {
                                                                                    fontWeight: 500
                                                                                },
                                                                                children: asin.rating
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                                lineNumber: 603,
                                                                                columnNumber: 29
                                                                            }, ("TURBOPACK compile-time value", void 0))
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                        lineNumber: 601,
                                                                        columnNumber: 27
                                                                    }, ("TURBOPACK compile-time value", void 0))
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 600,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                asin.weekHistory?.map((week, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        style: {
                                                                            backgroundColor: '#fffbeb',
                                                                            padding: '0.5rem 0.25rem',
                                                                            border: '1px solid #e5e7eb',
                                                                            textAlign: 'center'
                                                                        },
                                                                        children: getWeekHistoryBadge(week.rating, 'rating')
                                                                    }, `rating-${idx}`, false, {
                                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                        lineNumber: 608,
                                                                        columnNumber: 27
                                                                    }, ("TURBOPACK compile-time value", void 0))),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        padding: '0.75rem 0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: asin.reviewCount?.toLocaleString()
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 612,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        padding: '0.75rem 0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: getLqsBadge(asin.lqs)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 615,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        padding: '0.75rem 0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: getBuyBoxBadge(asin.buyBoxWin)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 618,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        padding: '0.75rem 0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: getAplusBadge(asin.hasAPlus)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 621,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        padding: '0.75rem 0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "badge",
                                                                        style: {
                                                                            backgroundColor: '#f3f4f6',
                                                                            color: '#374151',
                                                                            fontWeight: 500
                                                                        },
                                                                        children: asin.imagesCount
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                        lineNumber: 625,
                                                                        columnNumber: 27
                                                                    }, ("TURBOPACK compile-time value", void 0))
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 624,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        padding: '0.75rem 0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        style: {
                                                                            fontSize: '0.75rem',
                                                                            color: '#6b7280'
                                                                        },
                                                                        children: [
                                                                            asin.descLength,
                                                                            " chars"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                        lineNumber: 630,
                                                                        columnNumber: 27
                                                                    }, ("TURBOPACK compile-time value", void 0))
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 629,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0)),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    style: {
                                                                        padding: '0.75rem 0.5rem',
                                                                        borderBottom: '1px solid #e5e7eb'
                                                                    },
                                                                    children: getStatusBadge(asin.status)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                                    lineNumber: 634,
                                                                    columnNumber: 25
                                                                }, ("TURBOPACK compile-time value", void 0))
                                                            ]
                                                        }, asin.id, true, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 566,
                                                            columnNumber: 23
                                                        }, ("TURBOPACK compile-time value", void 0)))
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                    lineNumber: 564,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                            lineNumber: 529,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0))
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                        lineNumber: 528,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                lineNumber: 517,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                        lineNumber: 501,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    showAddModal && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "modal show d-block",
                        style: {
                            backgroundColor: 'rgba(0,0,0,0.5)'
                        },
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "modal-dialog",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "modal-content",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "modal-header",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h5", {
                                                className: "modal-title",
                                                children: "Add New ASIN"
                                            }, void 0, false, {
                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                lineNumber: 652,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                className: "btn-close",
                                                onClick: ()=>setShowAddModal(false)
                                            }, void 0, false, {
                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                lineNumber: 653,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                        lineNumber: 651,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "modal-body",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-muted mb-3",
                                                children: "Enter ASINs separated by commas to scrape product data from Amazon."
                                            }, void 0, false, {
                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                lineNumber: 656,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mb-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "form-label",
                                                        children: "ASIN(s)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                        lineNumber: 658,
                                                        columnNumber: 21
                                                    }, ("TURBOPACK compile-time value", void 0)),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                                        className: "form-control",
                                                        rows: "3",
                                                        placeholder: "B07XYZ123, B07ABC456, B07DEF789",
                                                        value: newAsin,
                                                        onChange: (e)=>setNewAsin(e.target.value)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                        lineNumber: 659,
                                                        columnNumber: 21
                                                    }, ("TURBOPACK compile-time value", void 0))
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                lineNumber: 657,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                        lineNumber: 655,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "modal-footer",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                className: "btn btn-secondary",
                                                onClick: ()=>setShowAddModal(false),
                                                children: "Cancel"
                                            }, void 0, false, {
                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                lineNumber: 669,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                className: "btn btn-primary",
                                                onClick: handleSync,
                                                disabled: syncing,
                                                children: syncing ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "spinner-border spinner-border-sm me-2"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                            lineNumber: 671,
                                                            columnNumber: 34
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        "Starting..."
                                                    ]
                                                }, void 0, true) : 'Start Scraping'
                                            }, void 0, false, {
                                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                                lineNumber: 670,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                        lineNumber: 668,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                                lineNumber: 650,
                                columnNumber: 15
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/pages/AsinManagerPage.jsx",
                            lineNumber: 649,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/src/pages/AsinManagerPage.jsx",
                        lineNumber: 648,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/pages/AsinManagerPage.jsx",
                lineNumber: 437,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true);
};
_s(AsinManagerPage, "j6SEStMsxgcIJvYxVrIZxl9+mXo=");
_c = AsinManagerPage;
const __TURBOPACK__default__export__ = AsinManagerPage;
var _c;
__turbopack_context__.k.register(_c, "AsinManagerPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_pages_AsinManagerPage_jsx_1c3ad6b3._.js.map