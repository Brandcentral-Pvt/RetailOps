import React from 'react';
import { LoadingIndicator } from './loading-indicator';

export const PageLoader = ({ message = 'Loading...', fullPage = true }) => {
  return (
    <div
      className={`d-flex flex-column justify-content-center align-items-center ${fullPage ? '' : ''}`}
      style={{
        minHeight: fullPage ? '60vh' : '200px',
        width: '100%',
        padding: '2rem',
      }}
    >
      <div style={{ width: '300px', textAlign: 'center' }}>
        <p className="text-muted small mb-3 fw-600">{message}</p>
        <LoadingIndicator type="line-simple" size="md" />
      </div>
    </div>
  );
};

export default PageLoader;
