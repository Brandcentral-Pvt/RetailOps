import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {App as AntApp,ConfigProvider} from 'antd';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AuthProvider} from '/src/contexts/AuthContext.jsx';
import {DateRangeProvider} from '/src/contexts/DateRangeContext.jsx';
import {PageTitleProvider} from '/src/contexts/PageTitleContext.jsx';
import DateRangeSelector from '/src/components/header/DateRangeSelector.jsx';
import OpsCenter from '/src/pages/opsCenter/OpsCenter.jsx';
import retailOpsTheme from '/src/theme/antdTheme';
import '/src/index.css';
import '/src/styles/global-overrides.css';
import '/src/App.css';
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
createRoot(document.getElementById('root')).render(
 <MemoryRouter><QueryClientProvider client={client}><ConfigProvider theme={retailOpsTheme}><AntApp><AuthProvider><DateRangeProvider><PageTitleProvider>
 <div style={{padding:16}}><DateRangeSelector/><OpsCenter/></div>
 </PageTitleProvider></DateRangeProvider></AuthProvider></AntApp></ConfigProvider></QueryClientProvider></MemoryRouter>
);