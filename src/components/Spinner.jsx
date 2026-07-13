import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

// Primary brand color of RetailOps is #1976D2
const antIcon = (
  <LoadingOutlined
    style={{
      fontSize: 28,
      color: '#1976D2',
    }}
    spin
  />
);

const antIconSmall = (
  <LoadingOutlined
    style={{
      fontSize: 18,
      color: '#1976D2',
    }}
    spin
  />
);

/**
 * Full Page / Section Spinner
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
      <Spin indicator={antIconSmall} size="small" />

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
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
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

// ==========================================
// MIGRATED FROM Loading.jsx FOR UNIFICATION
// ==========================================

export function LoadingSpinner({ size = 'default', tip, style }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px 20px',
      ...style
    }}>
      <Spin indicator={antIcon} size={size} tip={tip}>
        {tip && <div style={{ padding: 50 }} />}
      </Spin>
    </div>
  );
}

export function PageLoading({ message = 'Loading...' }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#f8fafc' // Aligned layout background
    }}>
      <Spin indicator={antIcon} size="large" />
      <div style={{
        marginTop: 16,
        fontSize: 13,
        color: '#64748b',
        fontWeight: 500
      }}>
        {message}
      </div>
    </div>
  );
}

export function CardLoading({ height = 200 }) {
  return (
    <div style={{
      height,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#f8fafc',
      borderRadius: 8
    }}>
      <Spin indicator={antIcon} />
    </div>
  );
}

export function InlineLoading({ tip = 'Loading...' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 0'
    }}>
      <Spin indicator={antIconSmall} size="small" />
      <span style={{ fontSize: 12, color: '#64748b' }}>{tip}</span>
    </div>
  );
}

export function TableLoading({ rows = 5 }) {
  return (
    <div style={{ padding: 20 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          height: 48,
          marginBottom: 8,
          background: '#f1f5f9',
          borderRadius: 4,
          animation: 'pulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.1}s`
        }} />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

const sizeMap = {
  sm: { height: '2px', width: '100%' },
  md: { height: '3px', width: '100%' },
  lg: { height: '4px', width: '100%' },
};

export const LoadingIndicator = ({ type = 'line-simple', size = 'md' }) => {
  const { height } = sizeMap[size] || sizeMap.md;

  if (type === 'line-simple') {
    return (
      <div style={{ width: '100%', overflow: 'hidden' }}>
        <div
          style={{
            height,
            width: '100%',
            backgroundColor: '#e2e8f0',
            borderRadius: '4px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '40%',
              backgroundColor: '#1976D2',
              borderRadius: '4px',
              animation: 'loadingIndicatorSlide 1.5s ease-in-out infinite',
            }}
          />
        </div>
        <style>{`
          @keyframes loadingIndicatorSlide {
            0% { left: -40%; }
            100% { left: 100%; }
          }
        `}</style>
      </div>
    );
  }

  return null;
};

export const PageLoader = ({ message = 'Loading...', fullPage = true }) => {
  return <PageLoading message={message} />;
};

export default Spinner;