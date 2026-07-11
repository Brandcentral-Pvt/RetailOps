import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const antIcon = (
  <LoadingOutlined
    style={{
      fontSize: 28,
      color: '#4F46E5',
    }}
    spin
  />
);

/**
 * Full Page / Section Spinner
 *
 * Usage:
 * <Spinner />
 * <Spinner tip="Loading Ads Manager..." />
 * <Spinner fullPage />
 * <Spinner minHeight={500} />
 */
export function Spinner({
  size = 'large',
  tip = '',
  fullPage = false,
  minHeight = 400,
  style = {},
}) {
  return (
    <div
      style={{
        width: '100%',
        height: fullPage ? '100vh' : '100%',
        minHeight: fullPage ? '100vh' : minHeight,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <Spin indicator={antIcon} size={size} />

        {tip && (
          <div
            style={{
              fontSize: 13,
              color: '#71717A',
              fontWeight: 500,
              textAlign: 'center',
            }}
          >
            {tip}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Spinner inside Cards / Tables / Sections
 *
 * Usage:
 * <ContentSpinner />
 * <ContentSpinner tip="Loading campaigns..." />
 */
export function ContentSpinner({
  tip = '',
  height = 300,
}) {
  return (
    <div
      style={{
        width: '100%',
        height,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Spin indicator={antIcon} />

        {tip && (
          <div
            style={{
              fontSize: 12,
              color: '#71717A',
              textAlign: 'center',
            }}
          >
            {tip}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Small Inline Spinner
 *
 * Usage:
 * <InlineSpinner />
 * <InlineSpinner tip="Saving..." />
 */
export function InlineSpinner({
  tip = '',
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <Spin indicator={antIcon} size="small" />

      {tip && (
        <span
          style={{
            fontSize: 12,
            color: '#71717A',
            fontWeight: 500,
          }}
        >
          {tip}
        </span>
      )}
    </div>
  );
}

/**
 * Loading Overlay
 *
 * Usage:
 * <LoadingOverlay />
 * <LoadingOverlay tip="Fetching data..." />
 */
export function LoadingOverlay({
  tip = 'Loading...',
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '28px 40px',
          borderRadius: 12,
          boxShadow:
            '0 10px 40px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Spin indicator={antIcon} size="large" />

        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#52525B',
          }}
        >
          {tip}
        </div>
      </div>
    </div>
  );
}

export default Spinner;