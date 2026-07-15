import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    Card, Input, Button, Table, Select, Space, Tag, Row, Col, InputNumber, Spin,
    message, Typography, Flex, Modal, List, Progress, Popconfirm, Badge, Avatar, Alert
} from 'antd';
import {
    SearchOutlined, DownloadOutlined, StarOutlined, ClearOutlined,
    SaveOutlined, FolderOpenOutlined, DeleteOutlined, BarChartOutlined,
    SwapOutlined, HistoryOutlined, ShoppingOutlined, BulbOutlined,
    RocketOutlined, PlusCircleOutlined, CheckCircleOutlined, AlertOutlined
} from '@ant-design/icons';
import {
    Search, Package, TrendingUp, TrendingDown, Activity
} from 'lucide-react';
import { keywordApi, keywordAnalysisApi } from '../services/api';
import PageHeader from '../components/common/PageHeader';
import KPICard from '../components/KPICard';
import EmptyState from '../components/common/EmptyState';

const { Text } = Typography;
const SAVED_LISTS_KEY = 'kw_saved_lists';
const RECENT_SEARCHES_KEY = 'kw_recent_searches';
const INR = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '-';

function loadSaved() { try { return JSON.parse(localStorage.getItem(SAVED_LISTS_KEY) || '[]'); } catch { return []; } }
function saveSaved(v) { localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(v)); }
function loadRecent() { try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]'); } catch { return []; } }
function saveRecent(v) { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(v)); }
function splitKeywords(s) { return s.split('\n').map(k => k.trim()).filter(k => k); }

const PRODUCT_COLUMNS = [
    {
        title: 'Product', dataIndex: 'title', key: 'title', width: 300,
        render: (title, r) => (
            <Flex gap={10} align="start">
                {r.mainImage ? (
                    <Avatar shape="square" size={40} src={r.mainImage} style={{ borderRadius: 6, flexShrink: 0, border: '1px solid #E5E7EB' }} />
                ) : (
                    <div style={{ width: 40, height: 40, background: '#F8FAFC', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1', flexShrink: 0, border: '1px solid #E5E7EB' }}>
                        <ShoppingOutlined style={{ fontSize: 16 }} />
                    </div>
                )}
                <div style={{ minWidth: 0 }}>
                    <Text style={{ fontSize: 13, lineHeight: '20px', color: '#0f172a' }} ellipsis={{ tooltip: title }}>{title || '-'}</Text>
                    <Flex wrap="gap" style={{ marginTop: 3 }}>
                        {r.brand && <Tag style={{ fontSize: 10, lineHeight: '18px', borderRadius: 4 }}>{r.brand}</Tag>}
                        {r.category && <Tag color="blue" style={{ fontSize: 10, lineHeight: '18px', borderRadius: 4 }}>{r.category}</Tag>}
                    </Flex>
                </div>
            </Flex>
        ),
    },
    {
        title: 'Price', key: 'price', width: 120, align: 'right',
        sorter: (a, b) => (a.price || 0) - (b.price || 0),
        render: (_, r) => (
            <div style={{ textAlign: 'right' }}>
                <Text strong style={{ fontSize: 14, color: '#0f172a' }}>{r.price != null ? INR(r.price) : '-'}</Text>
                {r.mrp != null && r.mrp > r.price && (
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>
                        <Text delete style={{ fontSize: 11, color: '#94A3B8' }}>{INR(r.mrp)}</Text>
                        {r.discountPercent != null && <Text style={{ color: '#D32F2F', marginLeft: 4, fontSize: 11, fontWeight: 600 }}>-{r.discountPercent}%</Text>}
                    </div>
                )}
            </div>
        ),
    },
    {
        title: 'Rating', dataIndex: 'rating', key: 'rating', width: 100, align: 'center',
        sorter: (a, b) => (a.rating || 0) - (b.rating || 0),
        render: (rating, r) => (
            <div>
                {rating != null ? (
                    <Space size={4}>
                        <StarOutlined style={{ color: '#FAAD14', fontSize: 13 }} />
                        <Text strong style={{ color: '#0f172a', fontSize: 13 }}>{Number(rating).toFixed(1)}</Text>
                    </Space>
                ) : <Text type="secondary">-</Text>}
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{r.reviewCount != null ? `${r.reviewCount.toLocaleString('en-IN')} reviews` : ''}</div>
            </div>
        ),
    },
    {
        title: 'BSR', dataIndex: 'mainBSR', key: 'mainBSR', width: 85, align: 'center',
        sorter: (a, b) => (a.mainBSR || 0) - (b.mainBSR || 0),
        defaultSortOrder: 'ascend',
        render: (bsr) => bsr != null
            ? <Tag style={{ fontFamily: 'monospace', borderRadius: 4, border: 'none', background: bsr <= 1000 ? '#F0FDF4' : bsr <= 10000 ? '#FFFBEB' : '#FEF2F2', color: bsr <= 1000 ? '#16A34A' : bsr <= 10000 ? '#D97706' : '#DC2626', fontWeight: 600 }}>#{bsr.toLocaleString('en-IN')}</Tag>
            : <Text type="secondary">-</Text>,
    },
    {
        title: 'Seller', dataIndex: 'seller', key: 'seller', width: 130, ellipsis: true,
        render: (s) => s || <Text type="secondary">-</Text>,
    },
    {
        title: 'Availability', dataIndex: 'availability', key: 'availability', width: 100,
        render: (a) => {
            if (!a) return <Text type="secondary">-</Text>;
            const ok = a.toLowerCase().includes('available') || a.toLowerCase().includes('in stock');
            return <Tag color={ok ? 'green' : 'orange'} style={{ borderRadius: 4, border: 'none' }}>{ok ? 'In Stock' : a}</Tag>;
        },
    },
];

const COMPARE_COLUMNS = [
    {
        title: 'Keyword', dataIndex: 'keyword', key: 'keyword', fixed: 'left', width: 190,
        render: (kw, r) => (
            <Flex align="center" gap={8}>
                <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{kw}</Text>
                {r.error && <Tag color="red" style={{ fontSize: 10, lineHeight: '16px', borderRadius: 4 }}>Error</Tag>}
            </Flex>
        ),
    },
    { title: 'Results', dataIndex: 'totalResults', key: 'totalResults', width: 70, align: 'right', sorter: (a, b) => a.totalResults - b.totalResults, render: (v) => <Text strong style={{ color: '#0f172a' }}>{v.toLocaleString('en-IN')}</Text> },
    { title: 'Avg Price', dataIndex: 'avgPrice', key: 'avgPrice', width: 95, align: 'right', sorter: (a, b) => a.avgPrice - b.avgPrice, render: (v) => v > 0 ? <Text style={{ color: '#0f172a', fontWeight: 600 }}>{INR(v)}</Text> : '-' },
    { title: 'Price Range', key: 'priceRange', width: 120, align: 'right', render: (_, r) => r.minPrice || r.maxPrice ? <Text style={{ fontSize: 12, color: '#64748b' }}>{INR(r.minPrice || 0)} – {INR(r.maxPrice || 0)}</Text> : '-' },
    { title: 'Rating', dataIndex: 'avgRating', key: 'avgRating', width: 80, align: 'center', sorter: (a, b) => a.avgRating - b.avgRating, render: (v) => v > 0 ? <Space size={2}><StarOutlined style={{ color: '#FAAD14', fontSize: 11 }} /><Text>{v.toFixed(1)}</Text></Space> : '-' },
    { title: 'Top Brand', dataIndex: 'topBrand', key: 'topBrand', width: 130, ellipsis: true, render: (v) => v !== '-' ? <Text style={{ fontSize: 12 }}>{v}</Text> : '-' },
    { title: 'Brands', dataIndex: 'brandCount', key: 'brandCount', width: 60, align: 'center' },
    { title: 'Avg BSR', dataIndex: 'avgBSR', key: 'avgBSR', width: 80, align: 'right', render: (v) => v > 0 ? <Tag style={{ fontFamily: 'monospace', borderRadius: 4, border: 'none', background: '#F1F5F9', fontWeight: 600, fontSize: 11 }}>#{v.toLocaleString('en-IN')}</Tag> : '-' },
];

export default function KeywordResearchPage() {
    const [tab, setTab] = useState('search');
    const [kw, setKw] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({ searchIndex: undefined, brand: '', minPrice: undefined, maxPrice: undefined, minReviewsRating: undefined, itemCount: 10, itemPage: 1, sortBy: 'Featured' });
    const [total, setTotal] = useState(0);
    const [lastQ, setLastQ] = useState('');
    const [refs, setRefs] = useState(null);
    const [saved, setSaved] = useState(loadSaved);
    const [recent, setRecent] = useState(loadRecent);
    const [saveOpen, setSaveOpen] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [multiKw, setMultiKw] = useState('');
    const [multiRes, setMultiRes] = useState(null);
    const [multiLoad, setMultiLoad] = useState(false);
    const [expKw, setExpKw] = useState(null);
    const [anaKw, setAnaKw] = useState('');
    const [anaRes, setAnaRes] = useState(null);
    const [anaLoad, setAnaLoad] = useState(false);
    const [anaProds, setAnaProds] = useState(null);

    const search = useCallback(async (page = 1) => {
        if (!kw.trim()) { message.warning('Enter keywords'); return; }
        setLoading(true); setLastQ(kw.trim());
        try {
            const p = { keywords: kw.trim(), itemCount: filters.itemCount, itemPage: page };
            if (filters.searchIndex && filters.searchIndex !== 'All') p.searchIndex = filters.searchIndex;
            if (filters.brand) p.brand = filters.brand;
            if (filters.minPrice != null) p.minPrice = filters.minPrice;
            if (filters.maxPrice != null) p.maxPrice = filters.maxPrice;
            if (filters.minReviewsRating != null) p.minReviewsRating = filters.minReviewsRating;
            if (filters.sortBy) p.sortBy = filters.sortBy;
            const d = await keywordApi.search(p);
            if (d.success) {
                setResults(d.items || []); setTotal(d.totalResultCount || 0); setRefs(d.searchRefinements || null);
                setFilters(prev => ({ ...prev, itemPage: page }));
                const r = loadRecent();
                saveRecent([{ kw: kw.trim(), time: Date.now() }, ...r.filter(x => x.kw !== kw.trim())].slice(0, 20));
                setRecent(loadRecent());
            } else message.error(d.error || 'Failed');
        } catch (e) { message.error(e.message); } finally { setLoading(false); }
    }, [kw, filters]);

    const multiSearch = useCallback(async () => {
        const kws = splitKeywords(multiKw);
        if (!kws.length) { message.warning('Enter keywords'); return; }
        if (kws.length > 20) { message.warning('Max 20'); return; }
        setMultiLoad(true); setMultiRes(null);
        try {
            const d = await keywordApi.batchSearch({ keywords: multiKw, itemCount: filters.itemCount, searchIndex: filters.searchIndex, minPrice: filters.minPrice, maxPrice: filters.maxPrice, minReviewsRating: filters.minReviewsRating });
            if (d.success) setMultiRes(d.results || []);
            else message.error(d.error || 'Failed');
        } catch (e) { message.error(e.message); } finally { setMultiLoad(false); }
    }, [multiKw, filters]);

    const doAnalysis = useCallback(async () => {
        if (!anaKw.trim()) { message.warning('Enter a keyword'); return; }
        setAnaLoad(true); setAnaRes(null); setAnaProds(null);
        try {
            const d = await keywordAnalysisApi.analyze({ keyword: anaKw.trim(), itemCount: 10 });
            if (d.success) { setAnaRes(d.analysis); setAnaProds(d.products); }
            else message.error(d.error || 'Failed');
        } catch (e) { message.error(e.message); } finally { setAnaLoad(false); }
    }, [anaKw]);

    const exportCsv = useCallback(() => {
        if (!results?.length) { message.warning('No results'); return; }
        const h = ['ASIN', 'Title', 'Price', 'MRP', 'Discount%', 'Rating', 'Reviews', 'Main BSR', 'Sub BSR', 'Brand', 'Seller', 'Availability', 'Parent ASIN', 'Category', 'Color', 'Size', 'Detail URL'];
        const r = results.map(i => [i.asin, `"${(i.title || '').replace(/"/g, '""')}"`, i.price ?? '', i.mrp ?? '', i.discountPercent ?? '', i.rating ?? '', i.reviewCount ?? '', i.mainBSR ?? '', i.subBSR ?? '', `"${(i.brand || '').replace(/"/g, '""')}"`, `"${(i.seller || '').replace(/"/g, '""')}"`, i.availability ?? '', i.parentAsin || '', i.category || '', i.color || '', i.size || '', i.detailPageURL || '']);
        const csv = [h.join(','), ...r.map(x => x.join(','))].join('\n');
        const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `keywords_${lastQ.replace(/\s+/g, '_')}.csv`; a.click(); message.success('Exported');
    }, [results, lastQ]);

    const exportComp = useCallback(() => {
        if (!multiRes?.length) { message.warning('Nothing to export'); return; }
        const h = ['Keyword', 'Total Results', 'Avg Price', 'Min Price', 'Max Price', 'Avg Rating', 'Top Brand', 'Avg BSR'];
        const r = multiRes.map(x => {
            const items = x.items || []; const prices = items.map(i => i.price).filter(Boolean); const ratings = items.map(i => i.rating).filter(Boolean); const bsrs = items.map(i => i.mainBSR).filter(Boolean); const brands = items.map(i => i.brand).filter(Boolean); const bc = {}; brands.forEach(b => { bc[b] = (bc[b] || 0) + 1; }); const tb = Object.entries(bc).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
            return [`"${x.keyword}"`, x.totalResultCount ?? 0, prices.length ? (prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(0) : '', prices.length ? Math.min(...prices) : '', prices.length ? Math.max(...prices) : '', ratings.length ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : '', `"${tb}"`, bsrs.length ? (bsrs.reduce((s, b) => s + b, 0) / bsrs.length).toFixed(0) : ''];
        });
        const csv = [h.join(','), ...r.map(x => x.join(','))].join('\n');
        const b = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'keyword_comparison.csv'; a.click(); message.success('Exported');
    }, [multiRes]);

    const saveList = useCallback(() => {
        if (!saveName.trim()) { message.warning('Enter a name'); return; }
        const lists = loadSaved();
        saveSaved([{ id: Date.now().toString(), name: saveName.trim(), keywords: kw.trim(), filters: { ...filters }, created: Date.now() }, ...lists]);
        setSaved(loadSaved()); setSaveOpen(false); setSaveName(''); message.success('Saved');
    }, [saveName, kw, filters]);

    const delList = useCallback((id) => { saveSaved(loadSaved().filter(l => l.id !== id)); setSaved(loadSaved()); message.success('Deleted'); }, []);

    const stats = useMemo(() => {
        if (!results?.length) return null;
        const prices = results.map(i => i.price).filter(Boolean);
        const ratings = results.map(i => i.rating).filter(Boolean);
        const reviews = results.map(i => i.reviewCount).filter(Boolean);
        const brands = results.map(i => i.brand).filter(Boolean);
        const cats = results.map(i => i.category).filter(Boolean);
        const bc = {}; brands.forEach(b => { bc[b] = (bc[b] || 0) + 1; });
        const pr = { '0-500': 0, '501-1000': 0, '1001-2000': 0, '2001-5000': 0, '5000+': 0 };
        results.forEach(i => { const p = i.price; if (p == null) return; if (p <= 500) pr['0-500']++; else if (p <= 1000) pr['501-1000']++; else if (p <= 2000) pr['1001-2000']++; else if (p <= 5000) pr['2001-5000']++; else pr['5000+']++; });
        return {
            total: results.length, avgPrice: prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0,
            minPrice: prices.length ? Math.min(...prices) : 0, maxPrice: prices.length ? Math.max(...prices) : 0,
            avgRating: ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0,
            totalReviews: reviews.reduce((s, r) => s + r, 0),
            topBrands: Object.entries(bc).sort((a, b) => b[1] - a[1]).slice(0, 5),
            brandCount: Object.keys(bc).length, categoryCount: new Set(cats).size, priceRanges: pr,
        };
    }, [results]);

    const compStats = useMemo(() => {
        if (!multiRes?.length) return null;
        return multiRes.map(r => {
            const items = r.items || []; const prices = items.map(i => i.price).filter(Boolean); const ratings = items.map(i => i.rating).filter(Boolean); const bsrs = items.map(i => i.mainBSR).filter(Boolean); const brands = items.map(i => i.brand).filter(Boolean); const bc = {}; brands.forEach(b => { bc[b] = (bc[b] || 0) + 1; });
            return {
                keyword: r.keyword, totalResults: r.totalResultCount || 0, itemCount: items.length,
                avgPrice: prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0,
                minPrice: prices.length ? Math.min(...prices) : 0, maxPrice: prices.length ? Math.max(...prices) : 0,
                avgRating: ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0,
                avgBSR: bsrs.length ? Math.round(bsrs.reduce((s, b) => s + b, 0) / bsrs.length) : 0,
                topBrand: Object.entries(bc).sort((a, b) => b[1] - a[1])[0]?.[0] || '-',
                brandCount: Object.keys(bc).length, items, error: r.error,
            };
        });
    }, [multiRes]);

    const tabContent = (key, children) => (
        <div style={{ display: tab === key ? 'block' : 'none' }}>{children}</div>
    );

    return (
        <div style={{ padding: '0 28px', maxWidth: 1440, margin: '0 auto' }}>
            <PageHeader
                title="Keyword Research"
                subtitle="Amazon.in Product Keyword Analysis"
                icon={Search}
                iconColor="#1976D2"
                breadcrumbs={[{ label: 'Catalog' }, { label: 'Keyword Research' }]}
                actions={
                    <Space size={8}>
                        {results?.length > 0 && (
                            <>
                                <Button size="small" icon={<SaveOutlined />} onClick={() => setSaveOpen(true)} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, borderColor: '#E5E7EB', height: 28 }}>Save</Button>
                                <Button size="small" icon={<DownloadOutlined />} onClick={exportCsv} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, borderColor: '#E5E7EB', height: 28 }}>CSV</Button>
                            </>
                        )}
                        {multiRes?.length > 0 && (
                            <Button size="small" icon={<DownloadOutlined />} onClick={exportComp} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, borderColor: '#E5E7EB', height: 28 }}>Export CSV</Button>
                        )}
                    </Space>
                }
            />

            {/* Tabs */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 20,
                borderBottom: '1px solid #E5E7EB', paddingBottom: 0,
            }}>
                {[
                    { key: 'search', label: 'Search', icon: <SearchOutlined /> },
                    { key: 'compare', label: 'Multi-Compare', icon: <SwapOutlined /> },
                    { key: 'saved', label: `Saved${saved.length ? ` (${saved.length})` : ''}`, icon: <FolderOpenOutlined /> },
                    { key: 'analysis', label: 'AI Analysis', icon: <BulbOutlined /> },
                ].map(t => (
                    <div key={t.key} onClick={() => setTab(t.key)}
                        style={{
                            padding: '10px 18px', cursor: 'pointer', borderRadius: '8px 8px 0 0',
                            fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
                            color: tab === t.key ? '#1976D2' : '#64748b',
                            background: tab === t.key ? '#fff' : 'transparent',
                            border: tab === t.key ? '1px solid #E5E7EB' : '1px solid transparent',
                            borderBottom: tab === t.key ? '1px solid #fff' : '1px solid transparent',
                            marginBottom: -1, transition: 'all 0.15s',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                        {t.icon} {t.label}
                    </div>
                ))}
            </div>

            {/* ──────────── SEARCH TAB ──────────── */}
            {tabContent('search', (
                <div>
                    <Card style={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)', marginBottom: 20 }}>
                        <Row gutter={[12, 12]}>
                            <Col xs={24} lg={12}>
                                <Input size="large" placeholder="Search Amazon.in products..."
                                    prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
                                    value={kw} onChange={e => setKw(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && search(1)}
                                    suffix={kw ? <ClearOutlined onClick={() => { setKw(''); setResults(null); setRefs(null); }} style={{ color: '#94A3B8', cursor: 'pointer' }} /> : null}
                                    style={{ borderRadius: 8, height: 40, fontSize: 14 }} />
                                {recent.length > 0 && !kw && (
                                    <Flex gap={4} wrap style={{ marginTop: 6 }}>
                                        <HistoryOutlined style={{ fontSize: 11, color: '#CBD5E1', marginTop: 3 }} />
                                        {recent.slice(0, 5).map(r => <Tag key={r.kw} style={{ cursor: 'pointer', fontSize: 11, borderRadius: 4, border: '1px solid #E5E7EB', margin: 0 }} onClick={() => setKw(r.kw)}>{r.kw}</Tag>)}
                                    </Flex>
                                )}
                            </Col>
                            <Col xs={12} lg={5}>
                                <Select size="large" placeholder="Category" allowClear style={{ width: '100%', borderRadius: 8, height: 40 }}
                                    value={filters.searchIndex} onChange={v => setFilters(p => ({ ...p, searchIndex: v }))}
                                    options={[
                                        { value: 'All', label: 'All Categories' }, { value: 'Electronics', label: 'Electronics' },
                                        { value: 'Clothing', label: 'Clothing & Accessories' }, { value: 'HomeAndKitchen', label: 'Home & Kitchen' },
                                        { value: 'Beauty', label: 'Beauty' }, { value: 'Sports', label: 'Sports & Outdoors' },
                                        { value: 'Toys', label: 'Toys & Games' }, { value: 'OfficeProducts', label: 'Office Products' },
                                        { value: 'HealthPersonalCare', label: 'Health & Personal Care' }, { value: 'Automotive', label: 'Automotive' },
                                        { value: 'Shoes', label: 'Shoes' }, { value: 'VideoGames', label: 'Video Games' },
                                    ]} />
                            </Col>
                            <Col xs={12} lg={7}>
                                <Button type="primary" size="large" block icon={<SearchOutlined />} onClick={() => search(1)} loading={loading}
                                    style={{ borderRadius: 8, height: 40, fontWeight: 600, background: '#1976D2', boxShadow: '0 2px 8px rgba(25,118,210,0.25)' }}>
                                    Search
                                </Button>
                            </Col>
                        </Row>
                        <Row gutter={[8, 8]} style={{ marginTop: 12 }}>
                            <Col xs={12} sm={6} md={4} lg={3}><Input placeholder="Brand" allowClear size="small" style={{ borderRadius: 6, height: 32 }} value={filters.brand} onChange={e => setFilters(p => ({ ...p, brand: e.target.value }))} onKeyDown={e => e.key === 'Enter' && search(1)} /></Col>
                            <Col xs={12} sm={6} md={4} lg={3}><InputNumber placeholder="Min ₹" size="small" style={{ width: '100%', borderRadius: 6, height: 32 }} min={0} value={filters.minPrice} onChange={v => setFilters(p => ({ ...p, minPrice: v }))} formatter={v => `₹ ${v}`} parser={v => v.replace(/[₹,\s]/g, '')} /></Col>
                            <Col xs={12} sm={6} md={4} lg={3}><InputNumber placeholder="Max ₹" size="small" style={{ width: '100%', borderRadius: 6, height: 32 }} min={0} value={filters.maxPrice} onChange={v => setFilters(p => ({ ...p, maxPrice: v }))} formatter={v => `₹ ${v}`} parser={v => v.replace(/[₹,\s]/g, '')} /></Col>
                            <Col xs={12} sm={6} md={4} lg={3}><Select placeholder="Rating" allowClear size="small" style={{ width: '100%', borderRadius: 6, height: 32 }} value={filters.minReviewsRating} onChange={v => setFilters(p => ({ ...p, minReviewsRating: v }))} options={[{ value: 4, label: '4+ Stars' }, { value: 3, label: '3+ Stars' }]} /></Col>
                            <Col xs={12} sm={6} md={4} lg={3}>
                                <Select placeholder="Sort" size="small" style={{ width: '100%', borderRadius: 6, height: 32 }} value={filters.sortBy} onChange={v => setFilters(p => ({ ...p, sortBy: v }))}
                                    options={[{ value: 'Featured', label: 'Featured' }, { value: 'Relevance', label: 'Relevance' }, { value: 'AvgCustomerReviews', label: 'Best Reviews' }, { value: 'Price:LowToHigh', label: 'Price: Low→High' }, { value: 'Price:HighToLow', label: 'Price: High→Low' }, { value: 'NewestArrivals', label: 'Newest' }]} />
                            </Col>
                            <Col xs={12} sm={6} md={4} lg={3}><Select placeholder="Per page" size="small" style={{ width: '100%', borderRadius: 6, height: 32 }} value={filters.itemCount} onChange={v => setFilters(p => ({ ...p, itemCount: v }))} options={[10, 20, 30, 50].map(n => ({ value: n, label: `${n}` }))} /></Col>
                        </Row>
                    </Card>

                    {loading && <Spin style={{ display: 'block', margin: '80px auto' }} />}

                    {results && !loading && (
                        <Row gutter={[20, 20]}>
                            <Col xs={24} lg={16}>
                                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
                                    <Flex justify="space-between" align="center" style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', background: '#F8FAFC' }}>
                                        <Space size={12}>
                                            <Text strong style={{ fontSize: 14, color: '#0f172a' }}>Results</Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>{results.length} of {total.toLocaleString('en-IN')} for &ldquo;{lastQ}&rdquo;</Text>
                                        </Space>
                                        <Tag style={{ fontSize: 10, fontWeight: 600, borderRadius: 4, background: '#F0FDF4', color: '#16A34A', border: 'none' }}>Sorted by BSR ↑</Tag>
                                    </Flex>
                                    <Table dataSource={results} columns={PRODUCT_COLUMNS} rowKey="asin" size="middle"
                                        pagination={{ current: filters.itemPage, pageSize: filters.itemCount, total: Math.min(total, 1000), onChange: search, showSizeChanger: false, showTotal: (t, [s, e]) => `${s}–${e} of ${t}` }}
                                        scroll={{ x: 860 }} />
                                </div>
                            </Col>
                            <Col xs={24} lg={8}>
                                {stats && (
                                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                                        <Row gutter={[12, 12]}>
                                            <Col span={12}>
                                                <KPICard title="Results" value={stats.total.toLocaleString('en-IN')} icon="Package" color="#1976D2" subtitle="products found" />
                                            </Col>
                                            <Col span={12}>
                                                <KPICard title="Avg Price" value={INR(stats.avgPrice)} icon="DollarSign" color="#16A34A" subtitle={`${INR(stats.minPrice)} – ${INR(stats.maxPrice)}`} />
                                            </Col>
                                            <Col span={12}>
                                                <KPICard title="Avg Rating" value={stats.avgRating ? stats.avgRating.toFixed(1) : '-'} icon="Star" color="#FAAD14" subtitle={`${stats.totalReviews.toLocaleString('en-IN')} reviews`} />
                                            </Col>
                                            <Col span={12}>
                                                <KPICard title="Brands" value={stats.brandCount} icon="Layers" color="#7C3AED" subtitle={`${stats.categoryCount} categories`} />
                                            </Col>
                                        </Row>

                                        <Card size="small" style={{ borderRadius: 12, border: '1px solid #E5E7EB' }}
                                            title={<Text style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price Distribution</Text>}>
                                            {Object.entries(stats.priceRanges).map(([range, count]) => {
                                                const pct = stats.total ? (count / stats.total) * 100 : 0;
                                                return (
                                                    <Flex key={range} align="center" gap={8} style={{ marginBottom: 6 }}>
                                                        <Text style={{ fontSize: 11, minWidth: 56, color: '#64748B' }}>₹{range}</Text>
                                                        <Progress percent={Math.round(pct)} size="small" showInfo={false} strokeColor={count > stats.total * 0.25 ? '#1976D2' : '#90CAF9'} style={{ flex: 1, margin: 0 }} />
                                                        <Text style={{ fontSize: 11, minWidth: 32, textAlign: 'right', color: '#64748B' }}>{count}</Text>
                                                    </Flex>
                                                );
                                            })}
                                        </Card>

                                        {stats.topBrands.length > 0 && (
                                            <Card size="small" style={{ borderRadius: 12, border: '1px solid #E5E7EB' }}
                                                title={<Text style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Brands</Text>}>
                                                {stats.topBrands.map(([brand, count], idx) => {
                                                    const pct = stats.total ? (count / stats.total) * 100 : 0;
                                                    const colors = ['#1976D2', '#7C3AED', '#0891B2', '#D32F2F', '#F59E0B'];
                                                    return (
                                                        <Flex key={brand} align="center" gap={8} style={{ marginBottom: 6 }}>
                                                            <Text style={{ fontSize: 11, minWidth: 14, color: '#CBD5E1', fontWeight: 600 }}>{idx + 1}</Text>
                                                            <Text ellipsis style={{ fontSize: 11, flex: 1, color: '#334155' }}>{brand}</Text>
                                                            <Progress percent={Math.round(pct)} size="small" showInfo={false} strokeColor={colors[idx]} style={{ flex: 1, margin: 0 }} />
                                                            <Text style={{ fontSize: 11, minWidth: 28, textAlign: 'right', color: '#64748B' }}>{count}</Text>
                                                        </Flex>
                                                    );
                                                })}
                                            </Card>
                                        )}

                                        {refs?.refinements?.length > 0 && (
                                            <Card size="small" style={{ borderRadius: 12, border: '1px solid #E5E7EB' }}
                                                title={<Space size={6}><BarChartOutlined style={{ color: '#1976D2' }} /><Text style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Refinements</Text></Space>}>
                                                {refs.refinements.map((ref, idx) => (
                                                    <div key={idx} style={{ marginBottom: 8 }}>
                                                        <Text style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>{ref.displayName}</Text>
                                                        <Space size={4} wrap>
                                                            {(ref.bins || []).slice(0, 5).map((bin, bi) => (
                                                                <Tag key={bi} style={{ fontSize: 11, cursor: 'pointer', borderRadius: 4, margin: 0, border: '1px solid #E5E7EB' }}
                                                                    onClick={() => ref.name === 'SearchIndex' && setFilters(p => ({ ...p, searchIndex: bin.value }))}>
                                                                    {bin.displayName} <Text type="secondary" style={{ fontSize: 10 }}>({bin.count})</Text>
                                                                </Tag>
                                                            ))}
                                                        </Space>
                                                    </div>
                                                ))}
                                            </Card>
                                        )}
                                    </Space>
                                )}
                            </Col>
                        </Row>
                    )}

                    {!results && !loading && (
                        <Card style={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
                            <EmptyState icon={Search} title="Amazon Keyword Research"
                                description="Enter keywords to search products on Amazon.in. Results sorted by Best Sellers (BSR)." />
                        </Card>
                    )}
                </div>
            ))}

            {/* ──────────── COMPARE TAB ──────────── */}
            {tabContent('compare', (
                <div>
                    <Card style={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)', marginBottom: 20 }}>
                        <Row gutter={12}>
                            <Col xs={24} md={16}>
                                <Input.TextArea rows={5} placeholder={`Paste keywords, one per line:\n\nsilk saree\ncotton saree\nkanchipuram saree`}
                                    value={multiKw} onChange={e => setMultiKw(e.target.value)}
                                    style={{ borderRadius: 8, fontSize: 13, borderColor: '#E5E7EB' }} />
                                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>{splitKeywords(multiKw).length} of 20 keywords</Text>
                            </Col>
                            <Col xs={24} md={8}>
                                <Button type="primary" size="large" block icon={<SearchOutlined />} onClick={multiSearch} loading={multiLoad}
                                    style={{ borderRadius: 8, height: 40, fontWeight: 600, background: '#1976D2', boxShadow: '0 2px 8px rgba(25,118,210,0.25)', marginBottom: 8 }}>
                                    Search All
                                </Button>
                                {multiRes?.length > 0 && <Button icon={<DownloadOutlined />} onClick={exportComp} block style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32, borderColor: '#E5E7EB' }}>Export CSV</Button>}
                                <div style={{ marginTop: 12 }}>
                                    <Text style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Common Filters</Text>
                                    <Row gutter={[8, 8]}>
                                        <Col span={12}><Select placeholder="Category" allowClear size="small" style={{ width: '100%', borderRadius: 6, height: 32 }} value={filters.searchIndex} onChange={v => setFilters(p => ({ ...p, searchIndex: v }))} options={[{ value: 'All', label: 'All' }, { value: 'Electronics', label: 'Electronics' }, { value: 'Clothing', label: 'Clothing' }]} /></Col>
                                        <Col span={12}><Select placeholder="Items/kw" size="small" style={{ width: '100%', borderRadius: 6, height: 32 }} value={filters.itemCount} onChange={v => setFilters(p => ({ ...p, itemCount: v }))} options={[5, 10, 20].map(n => ({ value: n, label: `${n}` }))} /></Col>
                                    </Row>
                                </div>
                            </Col>
                        </Row>
                    </Card>

                    {multiLoad && <Spin style={{ display: 'block', margin: '80px auto' }} />}

                    {compStats && !multiLoad && (
                        <Row gutter={[20, 20]}>
                            <Col xs={24} lg={16}>
                                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
                                    <Flex justify="space-between" align="center" style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', background: '#F8FAFC' }}>
                                        <Space size={12}>
                                            <Text strong style={{ fontSize: 14, color: '#0f172a' }}>Keyword Comparison</Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>{compStats.length} kw · {compStats.reduce((s, r) => s + r.totalResults, 0).toLocaleString('en-IN')} products</Text>
                                        </Space>
                                    </Flex>
                                    <Table dataSource={compStats} columns={COMPARE_COLUMNS} rowKey="keyword" pagination={false} scroll={{ x: 860 }} size="middle"
                                        expandable={{
                                            expandedRowRender: r => r.error ? <Alert type="error" message={r.error} style={{ margin: '12px 20px', borderRadius: 8 }} /> :
                                                !r.items?.length ? <EmptyState icon={Package} title="No items" /> :
                                                    <Table dataSource={r.items} columns={PRODUCT_COLUMNS} rowKey="asin" pagination={false} size="small" scroll={{ x: 800 }} />,
                                            expandedRowKeys: expKw ? [expKw] : [],
                                            onExpandedRowChange: keys => setExpKw(keys[0] || null),
                                        }} />
                                </div>
                            </Col>
                            <Col xs={24} lg={8}>
                                {compStats && (
                                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                                        <Card size="small" style={{ borderRadius: 12, border: '1px solid #E5E7EB' }}
                                            title={<Space size={6}><BarChartOutlined style={{ color: '#1976D2' }} /><Text style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Compare Insights</Text></Space>}>
                                            <Text style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>Avg Price</Text>
                                            {compStats.filter(r => r.avgPrice > 0).map(r => {
                                                const maxP = Math.max(...compStats.filter(x => x.avgPrice > 0).map(x => x.avgPrice), 1);
                                                return (
                                                    <Flex key={r.keyword} align="center" gap={8} style={{ marginBottom: 6 }}>
                                                        <Text ellipsis style={{ fontSize: 11, minWidth: 80, maxWidth: 90, color: '#334155' }}>{r.keyword}</Text>
                                                        <Progress percent={Math.round((r.avgPrice / maxP) * 100)} size="small" showInfo={false} strokeColor="#1976D2" style={{ flex: 1, margin: 0 }} />
                                                        <Text style={{ fontSize: 11, minWidth: 60, textAlign: 'right', color: '#64748B' }}>{INR(r.avgPrice)}</Text>
                                                    </Flex>
                                                );
                                            })}
                                            <div style={{ height: 1, background: '#E5E7EB', margin: '10px 0' }} />
                                            <Text style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>Total Results</Text>
                                            {compStats.map(r => {
                                                const maxR = Math.max(...compStats.map(x => x.totalResults), 1);
                                                return (
                                                    <Flex key={`r-${r.keyword}`} align="center" gap={8} style={{ marginBottom: 5 }}>
                                                        <Text ellipsis style={{ fontSize: 11, minWidth: 80, maxWidth: 90, color: '#334155' }}>{r.keyword}</Text>
                                                        <Progress percent={Math.round((r.totalResults / maxR) * 100)} size="small" showInfo={false} strokeColor="#7C3AED" style={{ flex: 1, margin: 0 }} />
                                                        <Text style={{ fontSize: 11, minWidth: 36, textAlign: 'right', color: '#64748B' }}>{r.totalResults}</Text>
                                                    </Flex>
                                                );
                                            })}
                                        </Card>
                                    </Space>
                                )}
                            </Col>
                        </Row>
                    )}

                    {!multiRes && !multiLoad && (
                        <Card style={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
                            <EmptyState icon={Activity} title="Compare Multiple Keywords"
                                description="Paste up to 20 keywords and search them all at once. Compare prices, ratings, BSR & more." />
                        </Card>
                    )}
                </div>
            ))}

            {/* ──────────── SAVED TAB ──────────── */}
            {tabContent('saved', (
                <Row gutter={[20, 20]}>
                    <Col xs={24} md={16}>
                        <Card style={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}
                            title={<Space size={8}><FolderOpenOutlined style={{ color: '#F59E0B' }} /><Text strong style={{ fontSize: 14, color: '#0f172a' }}>Saved Lists</Text><Tag color="orange" style={{ borderRadius: 4, fontSize: 10 }}>{saved.length} lists</Tag></Space>}>
                            {saved.length === 0 ? (
                                <EmptyState icon={FolderOpenOutlined} title="No Saved Lists" description="Run a search and save it for later." />
                            ) : (
                                <List
                                    dataSource={saved}
                                    renderItem={item => (
                                        <List.Item
                                            actions={[
                                                <Button type="link" size="small" icon={<SearchOutlined />} onClick={() => { setKw(item.keywords); if (item.filters) setFilters(item.filters); setTab('search'); }} style={{ fontSize: 12 }}>Load</Button>,
                                                <Popconfirm title="Delete this list?" onConfirm={() => delList(item.id)}>
                                                    <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 12 }}>Delete</Button>
                                                </Popconfirm>,
                                            ]}>
                                            <List.Item.Meta
                                                avatar={<Avatar size={36} icon={<FolderOpenOutlined />} style={{ background: '#F59B0B', borderRadius: 8 }} />}
                                                title={<Text strong style={{ color: '#0f172a' }}>{item.name}</Text>}
                                                description={<Space size={4} wrap><Tag style={{ fontSize: 11, borderRadius: 4, border: '1px solid #E5E7EB' }}>{item.keywords}</Tag>{item.filters?.searchIndex && <Tag color="blue" style={{ fontSize: 11, borderRadius: 4 }}>{item.filters.searchIndex}</Tag>}<Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(item.created).toLocaleDateString()}</Text></Space>}
                                            />
                                        </List.Item>
                                    )}
                                />
                            )}
                        </Card>
                    </Col>
                    <Col xs={24} md={8}>
                        <Card style={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}
                            title={<Space><HistoryOutlined /><Text strong style={{ fontSize: 13, color: '#0f172a' }}>Recent Searches</Text></Space>}
                            extra={recent.length > 0 ? <Button type="text" size="small" danger onClick={() => { saveRecent([]); setRecent([]); }} style={{ fontSize: 11 }}>Clear</Button> : null}>
                            {recent.length === 0 ? <Text type="secondary" style={{ fontSize: 12 }}>No recent searches</Text> : (
                                <Flex wrap gap={6}>
                                    {recent.map((r, i) => <Tag key={i} style={{ cursor: 'pointer', fontSize: 12, padding: '2px 10px', borderRadius: 6, border: '1px solid #E5E7EB', margin: 0 }} onClick={() => { setKw(r.kw); setTab('search'); }}>{r.kw}</Tag>)}
                                </Flex>
                            )}
                        </Card>
                    </Col>
                </Row>
            ))}

            {/* ──────────── AI ANALYSIS TAB ──────────── */}
            {tabContent('analysis', (
                <div>
                    <Card style={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)', marginBottom: 20 }}>
                        <Row gutter={12}>
                            <Col xs={24} md={16}>
                                <Input size="large" placeholder="Enter a seed keyword for AI analysis..."
                                    prefix={<BulbOutlined style={{ color: '#94A3B8' }} />}
                                    value={anaKw} onChange={e => setAnaKw(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && doAnalysis()}
                                    suffix={anaKw ? <ClearOutlined onClick={() => { setAnaKw(''); setAnaRes(null); setAnaProds(null); }} style={{ color: '#94A3B8', cursor: 'pointer' }} /> : null}
                                    style={{ borderRadius: 8, height: 40, fontSize: 14 }} />
                                <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
                                    AI analyzes top 10 best-selling products via <Tag icon={<RocketOutlined />} color="purple" style={{ borderRadius: 4, fontSize: 11 }}>NVIDIA AI</Tag> &mdash; extracts related keywords, gaps, trends
                                </Text>
                            </Col>
                            <Col xs={24} md={8}>
                                <Button type="primary" size="large" block icon={<BulbOutlined />} onClick={doAnalysis} loading={anaLoad}
                                    style={{ borderRadius: 8, height: 40, fontWeight: 600, background: '#1976D2', boxShadow: '0 2px 8px rgba(25,118,210,0.25)' }}>
                                    AI Analyze
                                </Button>
                            </Col>
                        </Row>
                    </Card>

                    {anaLoad && <Spin style={{ display: 'block', margin: '80px auto' }} />}

                    {anaRes && !anaLoad && (
                        <Row gutter={[20, 20]}>
                            <Col xs={24} lg={16}>
                                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
                                    <Flex justify="space-between" align="center" style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', background: '#F8FAFC' }}>
                                        <Space size={12}>
                                            <BulbOutlined style={{ color: '#7C3AED' }} />
                                            <Text strong style={{ fontSize: 14, color: '#0f172a' }}>AI-Generated Keywords</Text>
                                            <Tag icon={<RocketOutlined />} color="purple" style={{ borderRadius: 4, fontSize: 11 }}>NVIDIA AI</Tag>
                                        </Space>
                                        <Text type="secondary" style={{ fontSize: 12 }}>For &ldquo;{anaKw}&rdquo;</Text>
                                    </Flex>
                                    <div style={{ padding: 20 }}>
                                        {anaRes.suggestedKeywords?.length > 0 && (
                                            <>
                                                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12, color: '#0f172a' }}>Suggested Keywords</Text>
                                                <Row gutter={[8, 8]}>
                                                    {anaRes.suggestedKeywords.map((kw, idx) => (
                                                        <Col xs={24} sm={12} lg={8} key={idx}>
                                                            <Card size="small" style={{ borderRadius: 8, border: '1px solid #E5E7EB', height: '100%' }} hoverable>
                                                                <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
                                                                    <Text strong style={{ fontSize: 13, flex: 1, wordBreak: 'break-word', color: '#0f172a', lineHeight: '20px' }}>{kw.keyword}</Text>
                                                                    <Badge count={kw.opportunityScore}
                                                                        style={{ backgroundColor: kw.opportunityScore >= 70 ? '#16A34A' : kw.opportunityScore >= 40 ? '#D97706' : '#DC2626', fontSize: 10, fontWeight: 700, boxShadow: 'none', flexShrink: 0 }} />
                                                                </Flex>
                                                                <Space size={4} style={{ marginBottom: 4 }}>
                                                                    <Tag color={kw.type === 'head' ? 'blue' : kw.type === 'body' ? 'purple' : 'orange'} style={{ fontSize: 9, lineHeight: '16px', borderRadius: 4 }}>{kw.type}</Tag>
                                                                    <Tag color={kw.searchVolume === 'High' ? 'green' : kw.searchVolume === 'Medium' ? 'orange' : 'red'} style={{ fontSize: 9, lineHeight: '16px', borderRadius: 4, border: 'none' }}>{kw.searchVolume}</Tag>
                                                                    <Tag color={kw.competition === 'Low' ? 'green' : kw.competition === 'Medium' ? 'orange' : 'red'} style={{ fontSize: 9, lineHeight: '16px', borderRadius: 4, border: 'none' }}>{kw.competition}</Tag>
                                                                </Space>
                                                                <Text type="secondary" style={{ fontSize: 11, display: 'block', lineHeight: '16px' }}>{kw.rationale}</Text>
                                                            </Card>
                                                        </Col>
                                                    ))}
                                                </Row>
                                            </>
                                        )}

                                        {anaRes.keywordGaps?.length > 0 && (
                                            <div style={{ marginTop: 24 }}>
                                                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12, color: '#0f172a' }}>Keyword Gaps</Text>
                                                <Row gutter={[8, 8]}>
                                                    {anaRes.keywordGaps.map((gap, idx) => (
                                                        <Col xs={24} sm={12} key={idx}>
                                                            <Alert type="error" style={{ borderRadius: 8, padding: '10px 14px', border: '1px solid #FECACA' }}
                                                                message={<Space><AlertOutlined style={{ color: '#DC2626' }} /><Text strong style={{ fontSize: 12, color: '#0f172a' }}>{gap.category || 'General'}</Text></Space>}
                                                                description={<Flex wrap gap={4} style={{ marginTop: 4 }}>{gap.missingKeywords.map((mk, mi) => <Tag key={mi} style={{ fontSize: 11, borderRadius: 4, cursor: 'pointer' }} onClick={() => setAnaKw(mk)}>{mk}</Tag>)}</Flex>} />
                                                        </Col>
                                                    ))}
                                                </Row>
                                            </div>
                                        )}

                                        {anaRes.categoryOpportunities?.length > 0 && (
                                            <div style={{ marginTop: 24 }}>
                                                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12, color: '#0f172a' }}>Category Opportunities</Text>
                                                <Row gutter={[8, 8]}>
                                                    {anaRes.categoryOpportunities.map((cat, idx) => (
                                                        <Col xs={24} sm={8} key={idx}>
                                                            <Card size="small" style={{ borderRadius: 8, background: '#F0F5FF', border: '1px solid #D6E4FF' }}>
                                                                <Space><PlusCircleOutlined style={{ color: '#1976D2' }} /><Text strong style={{ fontSize: 12, color: '#0f172a' }}>{cat.category}</Text></Space>
                                                                <Flex wrap gap={4} style={{ marginTop: 6 }}>{cat.suggestedKeywords.map((sk, si) => <Tag key={si} color="blue" style={{ fontSize: 11, borderRadius: 4, cursor: 'pointer' }} onClick={() => setAnaKw(sk)}>{sk}</Tag>)}</Flex>
                                                            </Card>
                                                        </Col>
                                                    ))}
                                                </Row>
                                            </div>
                                        )}

                                        {anaRes.trendingTerms?.length > 0 && (
                                            <div style={{ marginTop: 24 }}>
                                                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12, color: '#0f172a' }}>Trending Terms</Text>
                                                <Space wrap>
                                                    {anaRes.trendingTerms.map((term, idx) => (
                                                        <Tag key={idx} icon={<RocketOutlined />} color="magenta" style={{ fontSize: 12, borderRadius: 6, padding: '2px 10px', cursor: 'pointer' }} onClick={() => setAnaKw(term)}>{term}</Tag>
                                                    ))}
                                                </Space>
                                            </div>
                                        )}

                                        {anaRes.summary && (
                                            <Alert type="success" style={{ marginTop: 24, borderRadius: 8, border: '1px solid #A7F3D0' }}
                                                message={<Space><CheckCircleOutlined style={{ color: '#16A34A' }} /><Text strong style={{ fontSize: 13, color: '#0f172a' }}>AI Strategy Summary</Text></Space>}
                                                description={<><Text strong style={{ color: '#1976D2' }}>Best Opportunity: {anaRes.summary.bestOpportunity}</Text><br /><Text style={{ fontSize: 12, color: '#334155', marginTop: 4, display: 'block' }}>{anaRes.summary.strategy}</Text></>} />
                                        )}
                                    </div>
                                </div>
                            </Col>
                            <Col xs={24} lg={8}>
                                {anaProds?.length > 0 && (
                                    <Card style={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)', padding: 0 }}
                                        title={<Space size={8}><ShoppingOutlined /><Text strong style={{ fontSize: 13, color: '#0f172a' }}>Products Analyzed</Text><Tag style={{ borderRadius: 4, fontSize: 10 }}>{anaProds.length}</Tag></Space>}>
                                        <div style={{ maxHeight: 540, overflow: 'auto' }}>
                                            {anaProds.map((p, idx) => (
                                                <Flex key={idx} gap={10} align="start" style={{ padding: '10px 16px', borderBottom: '1px solid #F1F5F9' }}>
                                                    <Avatar size={22} style={{ background: '#1976D2', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{idx + 1}</Avatar>
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <Text style={{ fontSize: 12, lineHeight: '18px', color: '#0f172a' }} ellipsis={{ tooltip: p.title }}>{p.title}</Text>
                                                        <Flex wrap gap={4} style={{ marginTop: 2 }}>
                                                            {p.brand && <Tag style={{ fontSize: 9, lineHeight: '14px', borderRadius: 3, border: '1px solid #E5E7EB' }}>{p.brand}</Tag>}
                                                            {p.price && <Tag color="green" style={{ fontSize: 9, lineHeight: '14px', borderRadius: 3 }}>{INR(p.price)}</Tag>}
                                                            {p.bsr && <Tag style={{ fontSize: 9, lineHeight: '14px', borderRadius: 3, fontFamily: 'monospace', border: '1px solid #E5E7EB' }}>#{p.bsr.toLocaleString('en-IN')}</Tag>}
                                                            {p.rating && <Tag style={{ fontSize: 9, lineHeight: '14px', borderRadius: 3 }}><StarOutlined /> {p.rating.toFixed(1)}</Tag>}
                                                        </Flex>
                                                    </div>
                                                </Flex>
                                            ))}
                                        </div>
                                    </Card>
                                )}
                            </Col>
                        </Row>
                    )}

                    {!anaRes && !anaLoad && (
                        <Card style={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
                            <EmptyState icon={BulbOutlined} title="AI Keyword Analysis"
                                description="Enter a seed keyword to discover related keywords, long-tail opportunities, gaps, and trends via NVIDIA AI." />
                        </Card>
                    )}
                </div>
            ))}

            <Modal title="Save Keyword List" open={saveOpen} onOk={saveList} onCancel={() => { setSaveOpen(false); setSaveName(''); }} okText="Save" width={400} style={{ borderRadius: 12 }}>
                <div style={{ margin: '8px 0' }}>
                    <Text style={{ display: 'block', marginBottom: 8, color: '#334155' }}>Search: <Text code style={{ fontSize: 12 }}>{kw}</Text></Text>
                    <Input placeholder="List name..." value={saveName} onChange={e => setSaveName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveList()} prefix={<SaveOutlined />} style={{ borderRadius: 6 }} />
                </div>
            </Modal>
        </div>
    );
}