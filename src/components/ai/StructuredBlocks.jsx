import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, TrendingUp, TrendingDown, AlertTriangle, Database, ChevronDown, ChevronRight } from 'lucide-react';
import { severityTag } from './aiUtils';

const KpiCard = ({ kpi }) => (
  <div className="ai-ws__kpi">
    <div className="ai-ws__kpi-label">{kpi.label}</div>
    <div className="ai-ws__kpi-value">{kpi.value}</div>
    {kpi.delta != null ? (
      <span className={`ai-ws__kpi-delta ${Number(kpi.delta) >= 0 ? 'ai-ws__kpi-delta--up' : 'ai-ws__kpi-delta--down'}`}>
        {Number(kpi.delta) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {Number(kpi.delta) >= 0 ? '+' : ''}
        {kpi.delta}%
      </span>
    ) : null}
  </div>
);

const DataTable = ({ table }) => {
  const [sortKey, setSortKey] = useState(null);
  const [dir, setDir] = useState(1);

  const rows = useMemo(() => {
    if (!sortKey) return table.rows || [];
    const col = table.columns.find((c) => c.key === sortKey);
    const isNum = col && col.numeric;
    return [...(table.rows || [])].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (isNum) return (Number(va) - Number(vb)) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [table, sortKey, dir]);

  const toggleSort = (c) => {
    if (sortKey === c.key) setDir((d) => -d);
    else {
      setSortKey(c.key);
      setDir(1);
    }
  };

  return (
    <div className="ai-ws__table-wrap">
      <table className="ai-ws__table">
        <thead>
          <tr>
            {(table.columns || []).map((c) => (
              <th key={c.key} onClick={() => toggleSort(c)} title="Sort column">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  {c.title}
                  {sortKey === c.key ? (
                    dir > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                  ) : (
                    <ArrowUpDown size={10} style={{ opacity: 0.45 }} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {(table.columns || []).map((c) => (
                <td key={c.key}>
                  {c.severity ? <span className={`ai-ws__tag ai-ws__tag--${severityTag(row[c.key])}`}>{row[c.key]}</span> : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const InsightCard = ({ insight }) => (
  <div className="ai-ws__alert">
    <div className="ai-ws__alert-title">
      <AlertTriangle size={13} /> {insight.title || 'Attention required'}
    </div>
    <div className="ai-ws__block-body">{insight.body}</div>
    {insight.actions?.length ? (
      <div className="ai-ws__block-actions">
        {insight.actions.map((a) => (
          <button key={a.label} type="button" className="ai-ws__btn ai-ws__btn--primary" onClick={a.onClick}>
            {a.label}
          </button>
        ))}
      </div>
    ) : null}
  </div>
);

const Recommendations = ({ items }) => (
  <div className="ai-ws__block">
    <div className="ai-ws__block-title">Recommended actions</div>
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--bc-text-secondary)', lineHeight: 1.6 }}>
      {items.map((r, i) => (
        <li key={i}>{r}</li>
      ))}
    </ul>
    <div className="ai-ws__block-actions">
      <button type="button" className="ai-ws__btn ai-ws__btn--primary">
        Apply recommendations
      </button>
    </div>
  </div>
);

const AsinCard = ({ asin }) => (
  <div className="ai-ws__block" style={{ margin: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
      <strong style={{ fontSize: 13, color: 'var(--bc-text-heading)' }}>{asin.asin}</strong>
      <span className="ai-ws__tag ai-ws__tag--ok">Active</span>
    </div>
    <div style={{ fontSize: 12, color: 'var(--bc-text-muted)', marginBottom: 8 }}>{asin.title}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11.5, color: 'var(--bc-text-secondary)' }}>
      <span>Sales</span><strong style={{ textAlign: 'right' }}>{asin.sales}</strong>
      <span>Orders</span><strong style={{ textAlign: 'right' }}>{asin.orders}</strong>
      <span>ROAS</span><strong style={{ textAlign: 'right' }}>{asin.roas}</strong>
      <span>Rating</span><strong style={{ textAlign: 'right' }}>{asin.rating}</strong>
    </div>
    <div className="ai-ws__block-actions" style={{ marginTop: 8 }}>
      <button type="button" className="ai-ws__btn" onClick={() => window.open(`/asin-tracker`, '_self')}>
        View ASIN
      </button>
    </div>
  </div>
);

const SourcesList = ({ sources, updated }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <span className="ai-ws__sources" role="button" tabIndex={0} onClick={() => setOpen((v) => !v)} onKeyDown={(e) => e.key === 'Enter' && setOpen((v) => !v)}>
        <Database size={12} /> Sources
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </span>
      {open ? (
        <div className="ai-ws__sources-pop">
          {sources.map((s) => (
            <div key={s} className="ai-ws__sources-row">
              <CheckDot /> {s}
            </div>
          ))}
          {updated ? <div style={{ fontSize: 10.5, color: 'var(--bc-text-muted)', marginTop: 4 }}>Updated {updated}</div> : null}
        </div>
      ) : null}
    </div>
  );
};

const CheckDot = () => (
  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bc-green-600)', display: 'inline-block', flexShrink: 0 }} />
);

const StructuredBlocks = ({ structured }) => {
  if (!structured) return null;
  return (
    <>
      {structured.kpis?.length ? (
        <div className="ai-ws__kpis">
          {structured.kpis.map((k) => (
            <KpiCard key={k.label} kpi={k} />
          ))}
        </div>
      ) : null}
      {structured.table ? <DataTable table={structured.table} /> : null}
      {structured.asins?.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, margin: '10px 0' }}>
          {structured.asins.map((a) => (
            <AsinCard key={a.asin} asin={a} />
          ))}
        </div>
      ) : null}
      {structured.insights?.length ? structured.insights.map((ins, i) => <InsightCard key={i} insight={ins} />) : null}
      {structured.recommendations?.length ? <Recommendations items={structured.recommendations} /> : null}
      {structured.sources?.length ? <SourcesList sources={structured.sources} updated={structured.updated} /> : null}
    </>
  );
};

export { KpiCard, DataTable, InsightCard, Recommendations, AsinCard, SourcesList };
export default StructuredBlocks;