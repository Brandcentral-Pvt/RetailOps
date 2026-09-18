import React from 'react';
import { LineChart, BarChart, PieChart } from '@mui/x-charts';
import { CorpEmpty } from './primitives';

const corpColors = ['#1976d2', '#15804d', '#b45309', '#b42318', '#0e7490', '#6d28d9', '#9333ea'];
const corpAxisStyle = { tickLabelStyle: { fontSize: 10, fill: '#8b98aa', fontFamily: 'Inter' } };

export const CorpLineChart = ({ labels = [], series = [], height = 220 }) => {
  const hasData = labels.length > 0 && series.some((s) => (s.data || []).some((v) => v !== 0));
  if (!hasData) return <CorpEmpty title="No chart data" subtitle="No data for this period." />;
  return (
    <LineChart
      height={height}
      skipAnimation
      grid={{ horizontal: true }}
      xAxis={[{ data: labels, ...corpAxisStyle, scaleType: 'band', tickNumber: labels.length }]}
      yAxis={[{ ...corpAxisStyle, tickLabelStyle: { ...corpAxisStyle.tickLabelStyle, textAnchor: 'end' } }]}
      series={series.map((s, i) => ({
        data: s.data || [],
        label: s.label || '',
        color: s.color || corpColors[i % corpColors.length],
        showMark: false,
        area: !!s.area,
        curve: 'natural',
        ...(s.area ? { areaOpacity: 0.12, lineWidth: 1.5 } : { lineWidth: 2 }),
      }))}
      colors={corpColors}
      slotProps={{ legend: { hidden: true } }}
      margin={{ top: 10, right: 12, bottom: 28, left: 52 }}
    />
  );
};

export const CorpBarChart = ({ labels = [], series = [], height = 220, vertical = true }) => {
  const hasData = labels.length > 0 && series.some((s) => (s.data || []).some((v) => v !== 0));
  if (!hasData) return <CorpEmpty title="No chart data" subtitle="No data for this period." />;
  return (
    <BarChart
      height={height}
      xAxis={[{ ...corpAxisStyle, scaleType: 'band', data: labels }]}
      yAxis={[{ ...corpAxisStyle, tickLabelStyle: { ...corpAxisStyle.tickLabelStyle, textAnchor: 'end' } }]}
      series={series.map((s, i) => ({
        data: s.data || [],
        label: s.label || '',
        color: s.color || corpColors[i % corpColors.length],
        stack: s.stack || undefined,
      }))}
      colors={corpColors}
      grid={{ horizontal: vertical }}
      slotProps={{ legend: { hidden: true } }}
      margin={{ top: 10, right: 12, bottom: 28, left: 52 }}
      borderRadius={2}
    />
  );
};

export const CorpPieChart = ({ data = [], height = 200, innerRadius = 62, centerLabel = null }) => {
  const total = data.reduce((a, b) => a + (b.value || 0), 0);
  const hasData = total > 0;
  if (!hasData) return <CorpEmpty title="No data" subtitle="Nothing to display." />;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height }}>
      <PieChart
        width={height}
        height={height}
        skipAnimation
        series={[{
          data: data.map((d, i) => ({
            id: d.id ?? i,
            value: d.value || 0,
            label: d.label,
            color: d.color || corpColors[i % corpColors.length],
          })),
          innerRadius,
          outerRadius: '88%',
          paddingAngle: 2,
          cornerRadius: 3,
          highlightScope: { fade: 'global' },
        }]}
        slotProps={{ legend: { hidden: true } }}
      />
      {centerLabel && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)', textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1a2433', lineHeight: 1, letterSpacing: -0.8 }}>
            {centerLabel.value}
          </div>
          {centerLabel.sub && (
            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#8b98aa', textTransform: 'uppercase', letterSpacing: 0.06, marginTop: 4 }}>
              {centerLabel.sub}
            </div>
          )}
        </div>
      )}
    </div>
  );
};