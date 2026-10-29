import React, { createContext, useContext, useState } from 'react';
import dayjs from 'dayjs';

const HeaderContext = createContext(null);

export const HeaderProvider = ({ children }) => {
  const [pageMeta, setPageMeta] = useState({
    title: 'Unified Operations Dashboard',
    subtitle: 'Real-time performance across all your sellers',
    breadcrumbs: [
      { label: 'Workspace' },
      { label: 'Dashboard' },
    ],
  });

  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const [datePreset, setDatePreset] = useState('last30');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  return (
    <HeaderContext.Provider
      value={{
        pageMeta, setPageMeta,
        dateRange, setDateRange,
        datePreset, setDatePreset,
        cmdOpen, setCmdOpen,
        notifOpen, setNotifOpen,
        downloadOpen, setDownloadOpen,
      }}
    >
      {children}
    </HeaderContext.Provider>
  );
};

export const useHeader = () => {
  const ctx = useContext(HeaderContext);
  if (!ctx) throw new Error('useHeader must be used within HeaderProvider');
  return ctx;
};
