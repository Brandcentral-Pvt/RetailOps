import React from 'react';
import { Skeleton, Row, Col } from 'antd';

const DashboardSkeleton = () => {
    return (
        <Row className="dashboard-layout" style={{ background: 'var(--bg-primary, var(--bc-slate-50))', minHeight: '100vh' }}>
            {/* Sidebar skeleton */}
            <Col span={24} md={2} style={{ background: 'var(--bg-secondary, var(--bc-slate-100))', height: '100vh' }}>
                <Skeleton height={200} className="mb-3" />
                <Skeleton height={120} className="mb-3" />
                <Skeleton height={100} className="mb-3" />
            </Col>

            {/* Main content skeleton */}
            <Col span={24} md={20} style={{ padding: '20px' }}>
                {/* Header skeleton */}
                <Skeleton rows={3} className="mb-4" />

                {/* KPI Strip skeleton */}
                <Skeleton rows={6} className="mb-4" />

                {/* Module Status skeleton */}
                <Skeleton rows={4} className="mb-4" />

                {/* Marketplace Distribution skeleton */}
                <Skeleton rows={3} className="mb-4" />

                {/* Analytics Section skeleton */}
                <Row gutter={20} style={{ marginBottom: 20 }}>
                    <Col xs={24} lg={14}>
                        <Skeleton rows={8} className="mb-3" />
                    </Col>
                    <Col xs={24} lg={10}>
                        <Skeleton rows={6} className="mb-3" />
                    </Col>
                </Row>

                {/* Data Cards skeleton */}
                <Row gutter={20} style={{ marginBottom: 20 }}>
                    <Col xs={24} md={8}>
                        <Skeleton rows={6} className="mb-3" />
                    </Col>
                    <Col xs={24} md={8}>
                        <Skeleton rows={6} className="mb-3" />
                    </Col>
                    <Col xs={24} md={8}>
                        <Skeleton rows={6} className="mb-3" />
                    </Col>
                </Row>

                {/* Activity Timeline skeleton */}
                <Skeleton rows={8} className="mb-4" />
            </Col>
        </Row>
    );
};

export default DashboardSkeleton;