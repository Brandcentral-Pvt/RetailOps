import React from 'react';
import {createRoot} from 'react-dom/client';
import {App as AntApp,ConfigProvider} from 'antd';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AuthProvider} from '/src/contexts/AuthContext.jsx';
import {DateRangeProvider} from '/src/contexts/DateRangeContext.jsx';
import {PageTitleProvider} from '/src/contexts/PageTitleContext.jsx';
import AdsManagerPage from '/src/pages/ads/AdsManagerPage.jsx';
import retailOpsTheme from '/src/theme/antdTheme';
import '/src/index.css';
import '/src/styles/global-overrides.css';
import '/src/App.css';

const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
// Use the production shell's flex and clipping rules, with an isolated sidebar
// to keep this regression independent of navigation, socket and onboarding APIs.
createRoot(document.getElementById('root')).render(
 <QueryClientProvider client={client}><ConfigProvider theme={retailOpsTheme}><AntApp><AuthProvider><DateRangeProvider><PageTitleProvider>
  <div className="app-shell"><aside aria-label="Test sidebar" style={{flex:'0 0 240px',background:'#fff'}}/>
   <div className="content-wrapper"><div style={{height:64,flexShrink:0}}>RetailOps</div>
    <main className="main-content"><div className="routes-container"><AdsManagerPage/></div></main>
   </div>
  </div>
 </PageTitleProvider></DateRangeProvider></AuthProvider></AntApp></ConfigProvider></QueryClientProvider>
);
