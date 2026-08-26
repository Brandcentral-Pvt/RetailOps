/**
 * RejectedTaskBanner — Shown on an IN_PROGRESS task that was
 * previously rejected. Displays the rejection feedback prominently
 * so the worker knows exactly what to fix before resubmitting.
 */

import React from 'react';
import { Alert, Collapse, Tag, Space, Typography } from 'antd';
import {
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

const RejectedTaskBanner = ({ task }) => {
  const rejections = task?.rejections;
  if (!Array.isArray(rejections) || rejections.length === 0) return null;

  const latest = rejections[rejections.length - 1];
  const isMultiple = rejections.length > 1;

  return (
    <div style={{ marginBottom: 12 }}>
      <Alert
        type="error"
        showIcon
        icon={<ExclamationCircleOutlined />}
        style={{
          borderRadius: 10,
          border: '1px solid #fecdd3',
          background: '#fff1f2',
        }}
        message={
          <Space size={8}>
            <Text strong style={{ color: '#be123c', fontSize: 'var(--font-size-sm)' }}>
              {isMultiple
                ? `Rejected ${rejections.length} times — address all feedback before resubmitting`
                : 'Task was rejected — please address the feedback below'}
            </Text>
            {isMultiple && (
              <Tag style={{
                background: 'var(--bc-red-100)', color: '#D32F2F',
                border: '1px solid var(--bc-red-200)', borderRadius: "var(--radius-lg)",
                fontSize: 10, fontWeight: 600,
              }}>
                {rejections.length} rejections
              </Tag>
            )}
          </Space>
        }
        description={
          <div style={{ marginTop: 8 }}>
            {/* Latest rejection always expanded */}
            <div style={{
              background: 'white',
              borderRadius: "var(--radius-md)",
              padding: '10px 14px',
              border: '1px solid #fecdd3',
              marginBottom: isMultiple ? 8 : 0,
            }}>
              <Space size={6} style={{ marginBottom: 6 }}>
                <ClockCircleOutlined style={{ color: 'var(--bc-slate-400)', fontSize: 'var(--font-size-xs)' }} />
                <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-slate-400)' }}>
                  {dayjs(latest.rejectedAt).fromNow()}
                </Text>
                <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-slate-400)' }}>·</Text>
                <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-slate-400)' }}>
                  Most recent rejection
                </Text>
              </Space>
              <Text style={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-slate-800)', display: 'block', lineHeight: 1.6 }}>
                {latest.reason || 'No reason provided'}
              </Text>
            </div>

            {/* Older rejections collapsed */}
            {isMultiple && rejections.length > 1 && (
              <Collapse
                ghost
                size="small"
                expandIcon={({ isActive }) => (
                  <RightOutlined
                    rotate={isActive ? 90 : 0}
                    style={{ fontSize: 10, color: 'var(--bc-slate-400)' }}
                  />
                )}
                items={[{
                  key: 'history',
                  label: (
                    <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-slate-400)' }}>
                      View {rejections.length - 1} earlier rejection{rejections.length - 1 > 1 ? 's' : ''}
                    </Text>
                  ),
                  children: (
                    <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                      {rejections
                        .slice(0, -1)
                        .reverse()
                        .map((r, i) => (
                          <div
                            key={i}
                            style={{
                              background: 'var(--bc-slate-50)',
                              borderRadius: 6,
                              padding: '8px 12px',
                              border: '1px solid var(--bc-slate-200)',
                            }}
                          >
                            <Text style={{ fontSize: 10, color: 'var(--bc-slate-400)', display: 'block', marginBottom: 3 }}>
                              Rejection #{rejections.length - 1 - i} · {dayjs(r.rejectedAt).fromNow()}
                            </Text>
                            <Text style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                              {r.reason || 'No reason provided'}
                            </Text>
                          </div>
                        ))}
                    </Space>
                  ),
                }]}
              />
            )}
          </div>
        }
      />
    </div>
  );
};

export default RejectedTaskBanner;
