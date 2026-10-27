import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import '/src/modules/tasks/views/oos/index.js';
import { AuthProvider } from '/src/contexts/AuthContext.jsx';
import SharedTaskShell from '/src/modules/tasks/components/SharedTaskShell.jsx';

createRoot(document.getElementById('root')).render(
  <ConfigProvider>
    <AntApp>
      <AuthProvider>
        <SharedTaskShell open taskId="inst-1" onClose={() => {}} />
      </AuthProvider>
    </AntApp>
  </ConfigProvider>,
);
