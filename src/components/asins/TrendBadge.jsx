import React from 'react';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';

const TrendBadge = ({ status }) => {
  if (!status || status === 'Stable') return (
    <div className="d-flex align-items-center gap-1 text-zinc-400" style={{ fontSize: '10px', fontWeight: 600 }}>
      <Activity size={10} />
      <span>Stable</span>
    </div>
  );

  if (status === 'Grow') {
    return (
      <div className="d-flex align-items-center gap-1 text-emerald-600" style={{ fontSize: '10px', fontWeight: 600 }}>
        <TrendingUp size={10} />
        <span>GROW</span>
      </div>
    );
  }

  if (status === 'Down') {
    return (
      <div className="d-flex align-items-center gap-1 text-red-500" style={{ fontSize: '10px', fontWeight: 600 }}>
        <TrendingDown size={10} />
        <span>DOWN</span>
      </div>
    );
  }

  return <span style={{ fontSize: '10px' }}>{status}</span>;
};

export default TrendBadge;
