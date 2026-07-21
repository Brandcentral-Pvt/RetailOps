import React, { useMemo, useState, memo, useEffect, useRef } from 'react';
import { Card, Tooltip, Segmented } from 'antd';
import { Link } from 'react-router-dom';
import {
    Trophy,
    Package, ArrowUpRight, BarChart3, Star,
    ChevronRight, Search, Filter, Eye, ShoppingBag, Loader2
} from 'lucide-react';
import { formatNumber, formatCurrency } from './utils';
import AsinRow from './AsinRow';

const BATCH_SIZE = 30;

// ═══════════════════════════════════════════════════════════════
// INTERNAL: Infinite-scroll product list (keyed to reset on filter change)
// ═══════════════════════════════════════════════════════════════
const ProductList = memo(({ products, maxValue, sortBy }) => {
    const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
    const sentinelRef = useRef(null);

    const visibleProducts = useMemo(() => products.slice(0, visibleCount), [products, visibleCount]);
    const hasMore = visibleCount < products.length;

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    setVisibleCount(prev => Math.min(prev + BATCH_SIZE, products.length));
                }
            },
            { rootMargin: '100px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, products.length]);

    if (products.length === 0) return null;

    return (
        <>
            {visibleProducts.map((product, idx) => (
                <AsinRow
                    key={product.asin + idx}
                    product={product}
                    rank={idx + 1}
                    maxValue={maxValue}
                    sortBy={sortBy}
                />
            ))}
            <div ref={sentinelRef} style={{ height: 1, width: '100%', visibility: 'hidden' }} />
            {hasMore && (
                <div style={{
                    textAlign: 'center',
                    padding: '16px 0',
                    color: 'var(--text-secondary, #64748b)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Loading more products...
                </div>
            )}
        </>
    );
});

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const TopAsinsCard = ({ products = [] }) => {
    const [sortBy, setSortBy] = useState('units');
    const [searchText, setSearchText] = useState('');

    // Process products
    const processedProducts = useMemo(() => {
        return products.map(p => ({
            title: p.title || 'Unknown Product',
            asin: p.asin || 'N/A',
            brand: p.brand || p.sku || 'N/A',
            units: Number(p.units || p.orders || 0),
            revenue: Number(p.revenue || p.sales || 0),
            trend: p.trend
        }));
    }, [products]);

    // Filter + sort
    const sortedProducts = useMemo(() => {
        let filtered = processedProducts;

        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(q) ||
                p.asin.toLowerCase().includes(q) ||
                p.brand.toLowerCase().includes(q)
            );
        }

        return filtered
            .sort((a, b) => {
                if (sortBy === 'revenue') return b.revenue - a.revenue;
                return b.units - a.units;
            });
    }, [processedProducts, sortBy, searchText]);

    // Stats
    const stats = useMemo(() => {
        const total = sortedProducts.length;
        const totalUnits = sortedProducts.reduce((sum, p) => sum + p.units, 0);
        const totalRevenue = sortedProducts.reduce((sum, p) => sum + p.revenue, 0);
        const topProduct = sortedProducts[0];
        return { total, totalUnits, totalRevenue, topProduct };
    }, [sortedProducts]);

    const maxValue = useMemo(() => {
        if (sortedProducts.length === 0) return 0;
        return sortBy === 'revenue' ? sortedProducts[0].revenue : sortedProducts[0].units;
    }, [sortedProducts, sortBy]);

    return (
        <>
            <Card
                styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
                style={{
                    borderRadius: "var(--radius-xl)",
                    border: '1px solid var(--border-light, var(--border-light, #d9e6e9))',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                    background: 'var(--bg-primary, #fff)',
                    height: 820,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {/* ═══════════════════════════════════════════════════
                    HEADER
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-light, var(--border-light, #d9e6e9))',
                    background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 12
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
                            <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: 11,
                                background: 'linear-gradient(135deg, #D32F2F 0%, #d94033 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--bg-primary, #fff)',
                                boxShadow: '0 4px 12px -2px rgba(251, 79, 64, 0.5)',
                                flexShrink: 0
                            }}>
                                <Trophy size={20} strokeWidth={2.5} className="crown-animate" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 'var(--font-size-base)',
                                    fontWeight: 700,
                                    color: 'var(--text-primary, #0f172a)',
                                    letterSpacing: '-0.01em',
                                    lineHeight: 1.2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    Top Performing ASINs
                                </div>
                                <div style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-secondary, #64748b)',
                                    fontWeight: 500,
                                    marginTop: 1
                                }}>
                                    Best products ranked by performance
                                </div>
                            </div>
                        </div>

                        <Link
                            to="/asin-tracker"
                            className="section-link-asins"
                            style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: 'var(--text-danger, #D32F2F)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            View All
                            <ArrowUpRight size={11} strokeWidth={2.5} />
                        </Link>
                    </div>

                    {/* Quick Stats Row */}
                    {stats.total > 0 && (
                        <div style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap'
                        }}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '4px 10px',
                                background: 'var(--bg-primary, #fff)',
                                border: '1px solid var(--border-light, var(--border-light, #d9e6e9))',
                                borderRadius: "var(--radius-lg)"
                            }}>
                                <Package size={11} style={{ color: 'var(--color-info-blue, #0288D1)' }} strokeWidth={2.5} />
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-info-blue, #0288D1)' }}>
                                    {stats.total}
                                </span>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>
                                    Products
                                </span>
                            </div>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '4px 10px',
                                background: 'var(--bg-primary, #fff)',
                                border: '1px solid var(--border-light, #d9e6e9)',
                                borderRadius: "var(--radius-lg)"
                            }}>
                                <ShoppingBag size={11} style={{ color: '#2E7D32' }} strokeWidth={2.5} />
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#2E7D32' }}>
                                    {formatNumber(stats.totalUnits)}
                                </span>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>
                                    Units
                                </span>
                            </div>
                            {stats.totalRevenue > 0 && (
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '4px 10px',
                                    background: 'var(--bg-primary, #fff)',
                                    border: '1px solid var(--border-light, var(--border-light, #d9e6e9))',
                                    borderRadius: "var(--radius-lg)"
                                }}>
                                    <BarChart3 size={11} style={{ color: '#9C27B0' }} strokeWidth={2.5} />
                                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#9C27B0' }}>
                                        {formatCurrency(stats.totalRevenue)}
                                    </span>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>
                                        Revenue
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════
                    CONTROLS BAR (Search + Sort)
                ═══════════════════════════════════════════════════ */}
                {stats.total > 0 && (
                    <div style={{
                        padding: '10px 20px',
                        background: 'var(--bg-secondary, #f8fafc)',
                        borderBottom: '1px solid var(--border-light, var(--border-light, #d9e6e9))',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap'
                    }}>
                        {/* Search */}
                        <div style={{
                            position: 'relative',
                            flex: 1,
                            minWidth: 140
                        }}>
                            <Search
                                size={12}
                                style={{
                                    position: 'absolute',
                                    left: 10,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-secondary, #64748b)',
                                    pointerEvents: 'none'
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Search ASIN, brand..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="asin-search-input"
                                style={{
                                    width: '100%',
                                    padding: '6px 10px 6px 30px',
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 500,
                                    color: 'var(--text-primary, #0f172a)',
                                    background: 'var(--bg-primary, #fff)',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Sort Toggle */}
                        <Segmented
                            value={sortBy}
                            onChange={setSortBy}
                            size="small"
                            options={[
                                {
                                    label: <Tooltip title="Sort by Units"><span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Units</span></Tooltip>,
                                    value: 'units'
                                },
                                {
                                    label: <Tooltip title="Sort by Revenue"><span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Revenue</span></Tooltip>,
                                    value: 'revenue'
                                }
                            ]}
                            style={{
                                background: 'var(--border-light, var(--border-light, #d9e6e9))'
                            }}
                        />
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                    PRODUCT LIST
                ═══════════════════════════════════════════════════ */}
                <div
                    className="top-asins-scroll"
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '14px 20px',
                        minHeight: 0
                    }}
                >
                    {sortedProducts.length === 0 ? (
                        <div style={{
                            padding: '40px 12px',
                            textAlign: 'center',
                            background: 'var(--bg-secondary, #f8fafc)',
                            border: '1px dashed var(--border-light, var(--border-light, #d9e6e9))',
                            borderRadius: "var(--radius-lg)",
                            margin: 'auto'
                        }}>
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 12,
                                border: '2px solid #fbbf24'
                            }}>
                                <Trophy size={24} style={{ color: 'var(--text-warning, #E65100)' }} strokeWidth={2.5} />
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary, #0f172a)', marginBottom: 4 }}>
                                {searchText ? 'No Products Found' : 'No Performance Data'}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)' }}>
                                {searchText
                                    ? 'Try different search keywords'
                                    : 'Top selling ASINs will appear here'}
                            </div>
                        </div>
                    ) : (
                        <ProductList
                            key={`${sortBy}-${searchText}`}
                            products={sortedProducts}
                            maxValue={maxValue}
                            sortBy={sortBy}
                        />
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════
                    FOOTER
                ═══════════════════════════════════════════════════ */}
                {stats.total > 0 && (
                    <div style={{
                        padding: '10px 20px',
                        background: 'var(--bg-secondary, #f8fafc)',
                        borderTop: '1px solid var(--border-light, var(--border-light, #d9e6e9))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8
                    }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-secondary, #64748b)',
                            fontWeight: 600
                        }}>
                            <Eye size={10} strokeWidth={2.5} />
                            Showing {sortedProducts.length} {sortedProducts.length === 1 ? 'product' : 'products'}
                        </div>

                        {stats.topProduct && (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: '#E65100',
                                background: 'var(--bg-warning-subtle, #fffbeb)',
                                padding: '3px 9px',
                                borderRadius: "var(--radius-lg)",
                                border: '1px solid var(--bg-warning-subtle, #fde68a)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 200
                            }}>
                                <Star size={10} strokeWidth={2.5} fill="#E65100" />
                                <span style={{
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    Top: {stats.topProduct.brand}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </>
    );
};

export default memo(TopAsinsCard);