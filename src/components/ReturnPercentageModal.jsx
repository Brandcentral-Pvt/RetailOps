import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Button, Input, Card } from './ui';

const ReturnPercentageModal = ({ item, isOpen, onClose, onSave }) => {
  const [returnPercent, setReturnPercent] = useState('');
  const [stepLevel, setStepLevel] = useState('Standard');

  useEffect(() => {
    if (item) {
      setReturnPercent(item.returnPercent || '');
      setStepLevel(item.stepLevel || 'Standard');
    }
  }, [item]);

  const handleSave = () => {
    const percent = parseFloat(returnPercent);
    if (isNaN(percent) || percent < 0 || percent > 100) {
      alert('Please enter a valid return percentage between 0 and 100');
      return;
    }

    onSave(item, percent, stepLevel);
    onClose();
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Return Percentage</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Product</label>
            <p className="text-sm text-slate-900 font-mono">{item.asin}</p>
            <p className="text-sm text-slate-600 truncate">{item.title}</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Return Percentage (%)</label>
            <Input
              type="number"
              inputClassName="w-full"
              placeholder="0-100"
              value={returnPercent}
              onChange={(e) => setReturnPercent(e.target.value)}
              min="0"
              max="100"
              step="0.1"
            />
            <p className="text-xs text-slate-500">Enter the expected return rate for this product</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">STEP Level</label>
            <select
              className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={stepLevel}
              onChange={(e) => setStepLevel(e.target.value)}
            >
              <option value="Basic">Basic</option>
              <option value="Standard">Standard</option>
              <option value="Advanced">Advanced</option>
              <option value="Premium">Premium</option>
            </select>
            <p className="text-xs text-slate-500">Amazon STEP (Seller Training and Evaluation Program) level</p>
          </div>
        </Card>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Save} onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReturnPercentageModal;
