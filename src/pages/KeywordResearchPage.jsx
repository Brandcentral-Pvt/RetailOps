import React, { useState, useCallback, useRef } from 'react';
import { Card, Input, Button, Table, Select, Space, Tag, Row, Col, InputNumber, Spin, Checkbox, Tooltip, Segmented, message, Empty, Statistic, Typography, Divider, Flex } from 'antd';
import { SearchOutlined, DownloadOutlined, ShoppingOutlined, StarOutlined, ClearOutlined, BulbOutlined, FilterOutlined } from '@ant-design/icons';
import { Search, Package, TrendingUp, DollarSign } from 'lucide-react';
import { keywordApi } from '../services/api';

const { Text, Title } = Typography;

export default function KeywordResearchPage() {
    const [keywords, setKeywords] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [filters, setFilters] = useState({
        searchIndex: undefined,
        brand: '',
        minPrice: undefined,
        maxPrice: undefined,
        minReviewsRating: undefined,
        itemCount: 10,
        itemPage: 1,
    });
    const [totalResults, setTotalResults] = useState(0);
    const [lastQuery, setLastQuery] = useState('');

    const handleSearch = useCallback(async (page = 1) => {
        if (!keywords.trim()) {
            message.warning('Enter keywords to search');
            return;
        }

        setLoading(true);
        setLastQuery(keywords.trim());

        try {
            const params = {
                keywords: keywords.trim(),
                itemCount: filters.itemCount,
                itemPage: page,
            };
            if (filters.searchIndex && filters.searchIndex !== 'All') params.searchIndex = filters.searchIndex;
            if (filters.brand) params.brand = filters.brand;
            if (filters.minPrice != null) params.minPrice = filters.minPrice;
            if (filters.maxPrice != null) params.maxPrice = filters.maxPrice;
            if (filters.minReviewsRating != null) params.minReviewsRating = filters.minReviewsRating;

            const data = await keywordApi.search(params);
            if (data.success) {
                setResults(data.items || []);
                setTotalResults(data.totalResultCount || 0);
                setFilters(prev => ({ ...prev, itemPage: page }));
            } else {
                message.error(data.error || 'Search failed');
            }
        } catch (err) {
            message.error(err.message);
        } finally {
            setLoading(false);
        }
    }, [keywords, filters.itemCount, filters.searchIndex, filters.brand, filters.minPrice, filters.maxPrice, filters.minReviewsRating]);

    const handleExport = useCallback(() => {
        if (!results || results.length === 0) {
            message.warning('No results to export');
            return;
        }

        const headers = ['ASIN', 'Title', 'Price', 'MRP', 'Discount%', 'Rating', 'Reviews', 'Main BSR', 'Sub BSR', 'Brand', 'Seller', 'Availability', 'Parent ASIN', 'Detail URL'];
        const rows = results.map(item => [
            item.asin,
            `"${(item.title || '').replace(/"/g, '""')}"`,
            item.price ?? '',
            item.mrp ?? '',
            item.discountPercent ?? '',
            item.rating ?? '',
            item.reviewCount ?? '',
            item.mainBSR ?? '',
            item.subBSR ?? '',
            `"${(item.brand || '').replace(/"/g, '""')}"`,
            `"${(item.seller || '').replace(/"/g, '""')}"`,
            item.availability ?? '',
            item.parentAsin || '',
            item.detailPageURL || '',
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `keyword_${lastQuery.replace(/\s+/g, '_')}_results.csv`;
        a.click();
        URL.revokeObjectURL(url);
        message.success('Exported successfully');
    }, [results, lastQuery]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSearch(1);
    };

    const columns = [
        {
            title: 'ASIN',
            dataIndex: 'asin',
            key: 'asin',
            width: 140,
            render: (asin) => (
                <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>{asin}</Text>
            ),
        },
        {
            title: 'Title',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
            render: (title, record) => (
                <div>
                    <Text style={{ fontSize: 13 }} ellipsis={{ tooltip: title }}>
                        {title || '-'}
                    </Text>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        {record.brand && <Tag style={{ fontSize: 10 }}>{record.brand}</Tag>}
                        {record.color && <Tag style={{ fontSize: 10 }}>{record.color}</Tag>}
                        {record.size && <Tag style={{ fontSize: 10 }}>{record.size}</Tag>}
                    </div>
                </div>
            ),
        },
        {
            title: 'Price',
            dataIndex: 'price',
            key: 'price',
            width: 100,
            align: 'right',
            render: (price, record) => (
                <div>
                    <Text style={{ fontWeight: 600 }}>
                        {price != null ? `₹${Number(price).toLocaleString()}` : '-'}
                    </Text>
                    {record.mrp != null && record.mrp > price && (
                        <div>
                            <Text delete style={{ fontSize: 11, color: '#999' }}>
                                ₹{Number(record.mrp).toLocaleString()}
                            </Text>
                            {record.discountPercent != null && (
                                <Text style={{ fontSize: 11, color: '#f5222d', marginLeft: 4 }}>
                                    -{record.discountPercent}%
                                </Text>
                            )}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Rating',
            dataIndex: 'rating',
            key: 'rating',
            width: 90,
            align: 'center',
            render: (rating, record) => (
                <div>
                    {rating != null ? (
                        <Space size={2}>
                            <StarOutlined style={{ color: '#faad14', fontSize: 12 }} />
                            <Text style={{ fontWeight: 600 }}>{Number(rating).toFixed(1)}</Text>
                        </Space>
                    ) : '-'}
                    <div style={{ fontSize: 11, color: '#888' }}>
                        {record.reviewCount != null ? `${record.reviewCount} reviews` : ''}
                    </div>
                </div>
            ),
        },
        {
            title: 'BSR',
            dataIndex: 'mainBSR',
            key: 'mainBSR',
            width: 80,
            align: 'right',
            render: (bsr) => bsr != null ? `#${Number(bsr).toLocaleString()}` : '-',
        },
        {
            title: 'Seller',
            dataIndex: 'seller',
            key: 'seller',
            width: 150,
            ellipsis: true,
            render: (seller) => seller || '-',
        },
        {
            title: 'Availability',
            dataIndex: 'availability',
            key: 'availability',
            width: 110,
            render: (avail) => {
                if (!avail) return '-';
                const isAvailable = avail.toLowerCase().includes('available') || avail.toLowerCase().includes('in stock');
                return (
                    <Tag color={isAvailable ? 'green' : 'orange'} style={{ fontSize: 11 }}>
                        {avail}
                    </Tag>
                );
            },
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <Flex justify="space-between" align="center" style={{ marginBottom: 20 }}>
                    <Space size={12}>
                        <div style={{ background: '#e6f4ff', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Search size={18} color="#1677ff" />
                            <Text strong style={{ fontSize: 16 }}>Keyword Research</Text>
                        </div>
                    </Space>
                    <Space>
                        {results && results.length > 0 && (
                            <Button icon={<DownloadOutlined />} onClick={handleExport}>
                                Export CSV
                            </Button>
                        )}
                    </Space>
                </Flex>

                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    <Col xs={24} md={12} lg={16}>
                        <Input
                            size="large"
                            placeholder="Search products on Amazon... (e.g., wireless earphones, yoga mat)"
                            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            onKeyDown={handleKeyDown}
                            suffix={
                                keywords ? (
                                    <ClearOutlined onClick={() => { setKeywords(''); setResults(null); }} style={{ color: '#bbb', cursor: 'pointer' }} />
                                ) : null
                            }
                        />
                    </Col>
                    <Col xs={12} md={6} lg={4}>
                        <Select
                            size="large"
                            placeholder="Category"
                            allowClear
                            style={{ width: '100%' }}
                            value={filters.searchIndex}
                            onChange={(v) => setFilters(prev => ({ ...prev, searchIndex: v }))}
                            options={[
                                { value: 'All', label: 'All Categories' },
                                { value: 'Electronics', label: 'Electronics' },
                                { value: 'HomeAndKitchen', label: 'Home & Kitchen' },
                                { value: 'Clothing', label: 'Clothing' },
                                { value: 'Beauty', label: 'Beauty' },
                                { value: 'Sports', label: 'Sports' },
                                { value: 'Toys', label: 'Toys & Games' },
                                { value: 'OfficeProducts', label: 'Office Products' },
                                { value: 'HealthPersonalCare', label: 'Health & Personal Care' },
                                { value: 'Automotive', label: 'Automotive' },
                                { value: 'PetSupplies', label: 'Pet Supplies' },
                                { value: 'Shoes', label: 'Shoes' },
                                { value: 'Tools', label: 'Tools' },
                                { value: 'VideoGames', label: 'Video Games' },
                            ]}
                        />
                    </Col>
                    <Col xs={12} md={6} lg={4}>
                        <Button
                            type="primary"
                            size="large"
                            icon={<SearchOutlined />}
                            onClick={() => handleSearch(1)}
                            loading={loading}
                            block
                            style={{ height: 40 }}
                        >
                            Search
                        </Button>
                    </Col>
                </Row>

                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    <Col xs={12} sm={8} md={4}>
                        <Input
                            placeholder="Brand"
                            value={filters.brand}
                            onChange={(e) => setFilters(prev => ({ ...prev, brand: e.target.value }))}
                            onKeyDown={handleKeyDown}
                            size="small"
                            prefix={<ShoppingOutlined style={{ color: '#bbb' }} />}
                            allowClear
                        />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                        <InputNumber
                            placeholder="Min Price"
                            value={filters.minPrice}
                            onChange={(v) => setFilters(prev => ({ ...prev, minPrice: v }))}
                            style={{ width: '100%' }}
                            size="small"
                            min={0}
                            formatter={(value) => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(value) => value.replace(/[₹,\s]/g, '')}
                        />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                        <InputNumber
                            placeholder="Max Price"
                            value={filters.maxPrice}
                            onChange={(v) => setFilters(prev => ({ ...prev, maxPrice: v }))}
                            style={{ width: '100%' }}
                            size="small"
                            min={0}
                            formatter={(value) => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(value) => value.replace(/[₹,\s]/g, '')}
                        />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                        <Select
                            placeholder="Min Rating"
                            allowClear
                            style={{ width: '100%' }}
                            size="small"
                            value={filters.minReviewsRating}
                            onChange={(v) => setFilters(prev => ({ ...prev, minReviewsRating: v }))}
                            options={[
                                { value: 4, label: '4+ Stars' },
                                { value: 3, label: '3+ Stars' },
                                { value: 2, label: '2+ Stars' },
                            ]}
                        />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                        <Select
                            placeholder="Results per page"
                            style={{ width: '100%' }}
                            size="small"
                            value={filters.itemCount}
                            onChange={(v) => setFilters(prev => ({ ...prev, itemCount: v }))}
                            options={[10, 20, 30, 50].map(n => ({ value: n, label: `${n} results` }))}
                        />
                    </Col>
                </Row>
            </Card>

            {loading && (
                <div style={{ textAlign: 'center', padding: 80 }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 16, color: '#888' }}>
                        Searching for &ldquo;{keywords}&rdquo;...
                    </div>
                </div>
            )}

            {results && !loading && (
                <>
                    <Card style={{ marginTop: 16, borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
                            <Space size={16}>
                                <Statistic
                                    title="Results"
                                    value={totalResults}
                                    prefix={<Package size={16} />}
                                    valueStyle={{ fontSize: 20 }}
                                />
                                <Statistic
                                    title="Avg Price"
                                    value={results.length > 0 ? results.reduce((s, i) => s + (i.price || 0), 0) / results.length : 0}
                                    prefix={<DollarSign size={16} />}
                                    precision={0}
                                    valueStyle={{ fontSize: 20 }}
                                />
                                <Statistic
                                    title="Avg Rating"
                                    value={results.length > 0 ? results.reduce((s, i) => s + (i.rating || 0), 0) / results.length : 0}
                                    prefix={<StarOutlined />}
                                    precision={1}
                                    valueStyle={{ fontSize: 20 }}
                                />
                            </Space>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Showing {results.length} of {totalResults} items for &ldquo;{lastQuery}&rdquo;
                            </Text>
                        </Flex>

                        <Table
                            dataSource={results}
                            columns={columns}
                            rowKey="asin"
                            pagination={{
                                current: filters.itemPage,
                                pageSize: filters.itemCount,
                                total: Math.min(totalResults, 1000),
                                onChange: handleSearch,
                                showSizeChanger: false,
                                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
                            }}
                            scroll={{ x: 900 }}
                            size="small"
                            style={{ fontSize: 13 }}
                        />
                    </Card>
                </>
            )}

            {!results && !loading && (
                <Card style={{ marginTop: 16, borderRadius: 12, border: '1px dashed #d9d9d9', background: '#fafafa' }}>
                    <Empty
                        image={<BulbOutlined style={{ fontSize: 48, color: '#bbb' }} />}
                        description={
                            <div>
                                <Text strong style={{ fontSize: 16 }}>Amazon Keyword Research</Text>
                                <div style={{ marginTop: 8, color: '#888' }}>
                                    Enter keywords above to search Amazon products.
                                    <br />
                                    Use filters to narrow down by category, price range, brand, or minimum rating.
                                </div>
                            </div>
                        }
                    />
                </Card>
            )}
        </div>
    );
}
