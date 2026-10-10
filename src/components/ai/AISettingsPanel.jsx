import { Drawer, Slider, Switch, Select, Input, Button, Tag } from 'antd';
import { RotateCcw } from 'lucide-react';
import ModelMenu from './ModelMenu';

const SYSTEM_PROMPTS = [
  { value: 'default', label: 'Standard assistant' },
  { value: 'brand', label: 'Brand & listing expert' },
  { value: 'analyst', label: 'Strict data analyst' },
];

const AISettingsPanel = ({ open, onClose, settings, onUpdate, onReset, models, modelId, onModelChange }) => {
  return (
    <Drawer title="AI settings" placement="right" width={380} open={open} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--bc-text-heading)' }}>AI Model</div>
          <div style={{ fontSize: 12, color: 'var(--bc-text-muted)', marginBottom: 8 }}>Fast, balanced or deep reasoning models.</div>
          <ModelMenu models={models} selectedId={modelId} onChange={onModelChange} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--bc-text-heading)' }}>Temperature</span>
            <Tag style={{ marginInlineEnd: 0, fontSize: 11 }}>{settings.temperature.toFixed(1)}</Tag>
          </div>
          <Slider
            min={0}
            max={2}
            step={0.1}
            value={settings.temperature}
            onChange={(v) => onUpdate({ temperature: v })}
            tooltip={{ open: false }}
          />
          <div style={{ fontSize: 11.5, color: 'var(--bc-text-muted)' }}>Lower is precise, higher is creative.</div>
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--bc-text-heading)' }}>Max output tokens</div>
          <Input
            type="number"
            min={256}
            max={8192}
            step={256}
            value={settings.maxTokens}
            onChange={(e) => onUpdate({ maxTokens: Number(e.target.value) || 2048 })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--bc-text-heading)' }}>Stream responses</div>
            <div style={{ fontSize: 11.5, color: 'var(--bc-text-muted)' }}>Token-by-token answers.</div>
          </div>
          <Switch checked={settings.streaming} onChange={(v) => onUpdate({ streaming: v })} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--bc-text-heading)' }}>Include database</div>
            <div style={{ fontSize: 11.5, color: 'var(--bc-text-muted)' }}>Let the AI ground answers with query results.</div>
          </div>
          <Switch checked={settings.includeDatabase} onChange={(v) => onUpdate({ includeDatabase: v })} />
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--bc-text-heading)' }}>System architecture</div>
          <Select
            style={{ width: '100%' }}
            value={settings.systemPrompt}
            onChange={(v) => onUpdate({ systemPrompt: v })}
            options={SYSTEM_PROMPTS}
          />
        </div>

        <Button icon={<RotateCcw size={14} />} onClick={onReset}>
          Reset defaults
        </Button>
      </div>
    </Drawer>
  );
};

export default AISettingsPanel;