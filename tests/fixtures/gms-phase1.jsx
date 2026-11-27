import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import { AuthProvider } from '/src/contexts/AuthContext.jsx';
import { DateRangeProvider } from '/src/contexts/DateRangeContext.jsx';
import { HeaderProvider } from '/src/contexts/HeaderContext.jsx';
import GmsTrackerPage from '/src/pages/GmsTrackerPage.jsx';
import retailOpsTheme from '/src/theme/antdTheme';
import '/src/index.css';

createRoot(document.getElementById('root')).render(
  <ConfigProvider theme={retailOpsTheme}><AntApp><AuthProvider><DateRangeProvider><HeaderProvider>
    <GmsTrackerPage />
  </HeaderProvider></DateRangeProvider></AuthProvider></AntApp></ConfigProvider>
);
