import React, { useEffect, useState, useRef } from 'react';
import { Download, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { exportApi } from '../../services/api';
import DownloadsDrawer from '../common/DownloadsDrawer';
import { Badge, Button, Tooltip } from 'antd';

const DownloadDrawer = () => {
  const { downloadOpen, setDownloadOpen } = useHeader();
  const [hasNew, setHasNew] = useState(false);
  const [downloads, setDownloads] = useState([]);
  const seenIds = useRef(new Set());
  const loading = useRef(false);

  useEffect(() => {
    const onExport = () => setDownloadOpen(true);
    window.addEventListener('export-started', onExport);
    return () => window.removeEventListener('export-started', onExport);
  }, [setDownloadOpen]);

  useEffect(() => {
    const checkNew = async () => {
      if (loading.current) return;
      loading.current = true;
      try {
        const res = await exportApi.getDownloads();
        if (res && res.success && res.data) {
          setDownloads(res.data);
          for (const d of res.data) {
            const id = d.Id || d.id || d._id;
            const status = (d.Status || d.status || '').toLowerCase();
            if (status === 'completed' && id && !seenIds.current.has(id)) {
              seenIds.current.add(id);
              setHasNew(true);
            }
          }
        }
      } catch {}
      loading.current = false;
    };
    checkNew();
    const interval = setInterval(checkNew, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = () => {
    setHasNew(false);
    setDownloadOpen(true);
  };

  const handleClose = () => {
    setDownloadOpen(false);
    const refresh = async () => {
      try {
        const res = await exportApi.getDownloads();
        if (res && res.success && res.data) {
          for (const d of res.data) {
            const id = d.Id || d.id || d._id;
            if (id) seenIds.current.add(id);
          }
          setDownloads(res.data);
        }
      } catch {}
    };
    refresh();
  };

  const getStatusIcon = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (s === 'failed' || s === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (s === 'processing' || s === 'pending') return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return 'bg-green-50 text-green-700 border-green-100';
    if (s === 'failed' || s === 'error') return 'bg-red-50 text-red-700 border-red-100';
    if (s === 'processing' || s === 'pending') return 'bg-blue-50 text-blue-700 border-blue-100';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <Tooltip title={hasNew ? 'Downloads: new files ready' : 'Downloads'}>
        <Button type="text" className="ro-header-icon" onClick={handleOpen}
          aria-label={`Downloads${hasNew ? ', new files ready' : ''}`} aria-expanded={downloadOpen}
          icon={<Badge dot={hasNew}><Download size={18} /></Badge>} />
      </Tooltip>

      <DownloadsDrawer
        isOpen={downloadOpen}
        onClose={handleClose}
      />
    </>
  );
};

export default DownloadDrawer;