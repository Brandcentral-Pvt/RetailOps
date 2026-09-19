import React from 'react';
import { Button, Typography } from 'antd';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const { Text } = Typography;

/**
 * SectionState — explicit per-section failure/unavailable placeholder.
 *
 * ✅ Honest states: dashboard sections previously rendered zeros or empty
 * charts when their data query failed, which reads as "no activity". This
 * component states plainly that the section is unavailable and offers a retry.
 */
const SectionState = ({
    title = 'Section unavailable',
    message = 'We could not load this data. Your numbers are not shown rather than shown as zero.',
    onRetry,
    height = 200,
}) => (
    <div
        style={{
            height,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'var(--bg-primary, #fff)',
            border: '1px dashed var(--dash-border, #e2e8f0)',
            borderRadius: 'var(--radius-xl, 16px)',
            padding: '16px 24px',
            marginBottom: 20,
            textAlign: 'center',
        }}
    >
        <div
            style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-md, 10px)',
                background: 'var(--bg-warning-subtle, #fffbeb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <AlertTriangle size={16} color="#ED6C02" />
        </div>
        <Text strong style={{ fontSize: 'var(--font-size-sm, 13px)', color: 'var(--text-primary, #0f172a)' }}>
            {title}
        </Text>
        <Text style={{ fontSize: 'var(--font-size-xs, 12px)', color: 'var(--text-secondary, #64748b)', maxWidth: 420 }}>
            {message}
        </Text>
        {onRetry && (
            <Button
                size="small"
                icon={<RefreshCw size={12} />}
                onClick={onRetry}
                style={{ marginTop: 2 }}
            >
                Retry
            </Button>
        )}
    </div>
);

export default SectionState;
