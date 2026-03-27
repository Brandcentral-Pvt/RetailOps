import React from 'react';

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
              backgroundColor: '#4F46E5',
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

export default LoadingIndicator;
