import React from 'react';
import { PageLoading } from '../../Loading';

export const PageLoader = ({ message = 'Loading...', fullPage = true }) => {
  return <PageLoading message={message} />;
};

export default PageLoader;
