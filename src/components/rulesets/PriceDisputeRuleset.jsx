import React, { useState, useEffect } from 'react';
import { Card, Button, Select, InputNumber, Switch, Typography, Tag, Space, Alert, Divider } from 'antd';
import { AlertTriangle, Users, ArrowRight, CheckCircle, Clock, ShoppingCart } from 'lucide-react';
import { rulesetApi, sellerApi } from '../services/api';
import toast from '../../utils/toast';

const { Text } = Typography;

const PriceDisputeRuleset = ({ onCreated }) => {
  const [loading, setLoading] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [selectedSellers, setSelectedSellers] = useState([]);
  const [threshold, setThreshold] = useState(10);
  const [autoCreateTask, setAutoCreateTask] = useState(true);
  const [taskPriority, setTaskPriority] = useState('HIGH');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const res = await sellerApi.getAll({ limit: 1000 });
        if (res.success) setSellers(res.data?.sellers || []);
      } catch (e) { console.error(e); }
    };
    fetchSellers();
  }, []);

  const handleCreate = async () => {
    if (selectedSellers.length === 0) {
      toast.warning('Please select at least one seller');
      return;
    }

    setLoading(true);
    try {
      // Create the ruleset
      const ruleset = {
        name: 'Price Dispute Detection',
        description: `Automatically detect price disputes (>₹${threshold} difference) and create tasks for assigned users`,
        type: 'ASIN',
        isActive,
        isAutomated: true,
        runFrequency: 'Daily',
        rules: [{
          order: 0,
          name: 'Price Dispute Check',
          isActive: true,
          conditions: [{
            attribute: 'priceDispute',
            operator: '>',
            value: threshold,
            value2: '',
            logicalOp: 'AND'
          }],
          action: {
            actionType: 'create_task',
            value: autoCreateTask ? `Price dispute detected - ₹${threshold}+ difference found. Please review and take action.` : '',
            assignTo: 'seller_manager'
          }
        }],
        scope: {
          applyTo: 'selected_sellers',
          sellerIds: selectedSellers
        }
      };

      const res = await rulesetApi.create(ruleset);
      if (res.success) {
        toast.success('Price dispute ruleset created successfully');
        if (onCreated) onCreated();
      }
    } catch (e) {
      toast.error('Failed to create ruleset');
    } finally {
      setLoading(false);
    }
  };

  const sellerOptions = sellers.map(s => ({
    label: `${s.name} (${s.marketplace || 'Amazon'})`,
    value: s._id || s.id
  }));

  return (
    <Card size="small" style={{ borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2' }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} color="#C62828" />
          <Text strong style={{ fontSize: 14, color: '#18181b' }}>Price Dispute Ruleset</Text>
        </div>
      }
    >
      <Alert 
        message="This ruleset will automatically detect price disputes across your selected sellers and create tasks for the assigned users to review and take action."
        type="info" 
        showIcon 
        style={{ marginBottom: 16, borderRadius: 8 }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Sellers Selection */}
        <div>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#18181b', display: 'block', marginBottom: 6 }}>
            <Users size={14} style={{ marginRight: 6 }} />
            Select Sellers
          </Text>
          <Select
            mode="multiple"
            placeholder="Select sellers to monitor"
            style={{ width: '100%' }}
            options={sellerOptions}
            value={selectedSellers}
            onChange={setSelectedSellers}
            maxTagCount="responsive"
          />
          <Text style={{ fontSize: 11, color: '#71717a', marginTop: 4, display: 'block' }}>
            Tasks will be assigned to users linked to these sellers
          </Text>
        </div>

        {/* Threshold */}
        <div>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#18181b', display: 'block', marginBottom: 6 }}>
            <AlertTriangle size={14} style={{ marginRight: 6 }} />
            Price Dispute Threshold (₹)
          </Text>
          <InputNumber
            min={1}
            max={10000}
            value={threshold}
            onChange={setThreshold}
            style={{ width: '100%' }}
            formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value.replace(/₹\s?|(,*)/g, '')}
          />
          <Text style={{ fontSize: 11, color: '#71717a', marginTop: 4, display: 'block' }}>
            Alert when price difference exceeds this amount
          </Text>
        </div>

        {/* Auto Task Creation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderRadius: 8, border: '1px solid #e4e4e7' }}>
          <div>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#18181b', display: 'block' }}>
              Auto-create Task
            </Text>
            <Text style={{ fontSize: 11, color: '#71717a' }}>
              Automatically create a task when dispute is detected
            </Text>
          </div>
          <Switch checked={autoCreateTask} onChange={setAutoCreateTask} />
        </div>

        {/* Task Priority */}
        {autoCreateTask && (
          <div>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#18181b', display: 'block', marginBottom: 6 }}>
              Task Priority
            </Text>
            <Select
              value={taskPriority}
              onChange={setTaskPriority}
              style={{ width: '100%' }}
              options={[
                { label: 'High', value: 'HIGH' },
                { label: 'Medium', value: 'MEDIUM' },
                { label: 'Low', value: 'LOW' }
              ]}
            />
          </div>
        )}

        {/* Active Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderRadius: 8, border: '1px solid #e4e4e7' }}>
          <div>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#18181b', display: 'block' }}>
              Activate Ruleset
            </Text>
            <Text style={{ fontSize: 11, color: '#71717a' }}>
              Enable this ruleset to run automatically
            </Text>
          </div>
          <Switch checked={isActive} onChange={setIsActive} />
        </div>

        {/* Summary */}
        <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
          <Text style={{ fontSize: 11, color: '#2E7D32', display: 'block' }}>
            <CheckCircle size={12} style={{ marginRight: 4 }} />
            When a price dispute is detected:
          </Text>
          <ul style={{ margin: '4px 0 0 20px', fontSize: 11, color: '#166534' }}>
            <li>Task will be created automatically</li>
            <li>Assigned to users linked to the seller</li>
            <li>Priority: {taskPriority}</li>
            <li>Rule will run {isActive ? 'daily' : 'manually'}</li>
          </ul>
        </div>

        {/* Create Button */}
        <Button type="primary" block loading={loading} onClick={handleCreate}
          style={{ height: 40, borderRadius: 8, fontWeight: 600 }}>
          Create Price Dispute Ruleset
        </Button>
      </div>
    </Card>
  );
};

export default PriceDisputeRuleset;
