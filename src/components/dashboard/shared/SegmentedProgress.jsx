import React, { memo } from 'react';
import { Tooltip } from 'antd';

const SegmentedProgress = memo(({ segments = [], height = 8 }) => {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) {
        return (
            <div style={{
                height,
                background: 'var(--border-light, #d9e6e9)',
                borderRadius: height / 2,
                overflow: 'hidden'
            }} />
        );
    }

    return (
        <div style={{
            display: 'flex',
            height,
            background: 'var(--border-light, #d9e6e9)',
            borderRadius: height / 2,
            overflow: 'hidden',
            gap: 1
        }}>
            {segments.map((seg, i) => {
                const pct = (seg.value / total) * 100;
                if (pct < 0.5) return null;
                return (
                    <Tooltip key={i} title={`${seg.label}: ${seg.value}`}>
                        <div
                            style={{
                                width: `${pct}%`,
                                background: seg.color,
                                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer'
                            }}
                        />
                    </Tooltip>
                );
            })}
        </div>
    );
});

export default SegmentedProgress;
