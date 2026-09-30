import React, { useState, useEffect } from 'react';
import { Card, Button, Tag, Tooltip, Spin, Empty, Progress } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  Zap, PlayCircle, PauseCircle, AlertTriangle, Clock, CheckCircle2,
  TrendingUp, ArrowRight, Sparkles, Plus, Settings, BarChart3
} from 'lucide-react';
import { rulesetApi } from '../../services/api';

const AutomationRulesCard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({
    total: 0, active: 0, autoRun: 0, paused: 0,
    last24hRuns: 0, last24hMatched: 0, recent: [], loading: true, error: null
  });

  useEffect(() => {
    let mounted = true;
    rulesetApi.getAll()
      .then(res => {
        if (!mounted) return;
        const list = res?.data || [];
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        let runs24 = 0;
        let matched24 = 0;
        list.forEach(r => {
          const lastRun = r.lastRunAt ? new Date(r.lastRunAt).getTime() : 0;
          let summary = {};
          try { summary = JSON.parse(r.lastRunSummary || '{}'); } catch {}
          if (lastRun > cutoff) {
            runs24 += (r.totalRunCount || 0) > 0 ? 1 : 0;
            matched24 += summary.totalMatched || 0;
          }
        });
        setData({
          total: list.length,
          active: list.filter(r => r.isActive).length,
          autoRun: list.filter(r => r.isAutomated).length,
          paused: list.filter(r => !r.isActive).length,
          last24hRuns: runs24,
          last24hMatched: matched24,
          recent: list
            .filter(r => r.lastRunAt)
            .sort((a, b) => new Date(b.lastRunAt) - new Date(a.lastRunAt))
            .slice(0, 4),
          loading: false,
          error: null
        });
      })
      .catch(err => {
        if (!mounted) return;
        setData(d => ({ ...d, loading: false, error: err.message }));
      });
    return () => { mounted = false; };
  }, []);

  if (data.loading) {
    return (
      <Card className="dash-automation-card" styles={{ body: { padding: 24 } }}>
        <div style={{ textAlign: 'center', padding: '24px 0' }}><Spin /></div>
      </Card>
    );
  }

  const activePct = data.total > 0 ? Math.round((data.active / data.total) * 100) : 0;

  return (
    <Card
      className="dash-automation-card"
      styles={{ body: { padding: 0 } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={16} style={{ color: 'var(--bc-primary-600)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Automation Rules</span>
          <Tag color={data.total > 0 ? 'blue' : 'default'} style={{ marginLeft: 'auto', borderRadius: 4 }}>
            {data.total} total
          </Tag>
        </div>
      }
      extra={
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="AI Create Rule">
            <Button
              type="text"
              size="small"
              icon={<Sparkles size={14} style={{ color: '#8B5CF6' }} />}
              onClick={() => navigate('/rule-sets/new?ai=1')}
            />
          </Tooltip>
          <Tooltip title="Manage Rules">
            <Button
              type="text"
              size="small"
              icon={<Settings size={14} />}
              onClick={() => navigate('/rule-sets')}
            />
          </Tooltip>
        </div>
      }
    >
      <div style={{ padding: '12px 20px 16px' }}>
        {/* Top KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          <MiniStat icon={<CheckCircle2 size={14} />} label="Active" value={data.active} color="var(--bc-status-success)" />
          <MiniStat icon={<Clock size={14} />} label="Auto-run" value={data.autoRun} color="var(--bc-status-info)" />
          <MiniStat icon={<PlayCircle size={14} />} label="Runs (24h)" value={data.last24hRuns} color="var(--bc-primary-600)" />
          <MiniStat icon={<BarChart3 size={14} />} label="Matched (24h)" value={data.last24hMatched} color="#8B5CF6" />
        </div>

        {/* Health bar */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--bc-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <span>Health</span>
            <span>{data.active}/{data.total} active</span>
          </div>
          <Progress
            percent={activePct}
            showInfo={false}
            strokeColor={{
              '0%': '#EF4444',
              '50%': '#F59E0B',
              '80%': '#10B981',
            }}
            size="small"
            style={{ margin: 0 }}
          />
        </div>

        {/* Recent runs */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Recent Runs</div>
        {data.recent.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ fontSize: 12, color: 'var(--bc-text-muted)' }}>
                No rules have run yet
              </span>
            }
          >
            <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => navigate('/rule-sets/new')}>
              Create your first rule
            </Button>
          </Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.recent.map(r => {
              let summary = {};
              try { summary = JSON.parse(r.lastRunSummary || '{}'); } catch {}
              const failed = summary.failed > 0;
              return (
                <button
                  key={r._id || r.id}
                  type="button"
                  onClick={() => navigate(`/rule-sets/${r._id || r.id}`)}
                  className="dash-automation-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 8, border: '1px solid var(--bc-border-default)',
                    background: 'var(--bc-surface-card)', cursor: 'pointer', textAlign: 'left',
                    width: '100%', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--bc-primary-400)'; e.currentTarget.style.background = 'var(--bc-surface-muted)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bc-border-default)'; e.currentTarget.style.background = 'var(--bc-surface-card)'; }}
                >
                  {r.isActive
                    ? <PlayCircle size={14} style={{ color: 'var(--bc-status-success)', flexShrink: 0 }} />
                    : <PauseCircle size={14} style={{ color: 'var(--bc-text-muted)', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bc-text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--bc-text-muted)' }}>
                      {r.lastRunAt ? new Date(r.lastRunAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                      {summary.executionTimeMs ? ` · ${(summary.executionTimeMs / 1000).toFixed(1)}s` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: failed ? 'var(--bc-status-danger)' : 'var(--bc-status-success)' }}>
                      {summary.totalMatched ?? 0}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--bc-text-muted)' }}>matched</div>
                  </div>
                  <ArrowRight size={12} style={{ color: 'var(--bc-text-muted)', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        )}

        <Button
          type="primary"
          block
          size="small"
          icon={<ArrowRight size={12} />}
          onClick={() => navigate('/rule-sets')}
          style={{ marginTop: 12, borderRadius: 8, fontWeight: 600 }}
        >
          View all automation rules
        </Button>
      </div>
    </Card>
  );
};

const MiniStat = ({ icon, label, value, color }) => (
  <div style={{
    padding: '8px 10px',
    background: 'var(--bc-surface-muted)',
    borderRadius: 8,
    border: '1px solid var(--bc-border-default)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color, marginBottom: 2 }}>
      {icon}
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--bc-text-muted)' }}>{label}</span>
    </div>
    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--bc-text-heading)', lineHeight: 1 }}>{value}</div>
  </div>
);

export default AutomationRulesCard;
