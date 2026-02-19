import React, { useEffect, useState } from 'react';
import { Input, Button, Card } from './ui';
import { db } from '../services/db';
import { ShieldCheck, CheckCircle, User, KeyRound } from 'lucide-react';

const UserSettings = () => {
  const [email, setEmail] = useState('');
  const [keepaKey, setKeepaKey] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get user information from localStorage or db
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user?.email) setEmail(user.email);
    setKeepaKey(db.getKeepaKey());
  }, []);

  const saveSettings = () => {
    setLoading(true);

    setTimeout(() => {
      // Save user settings
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.email = email;
      localStorage.setItem('user', JSON.stringify(user));
      
      db.saveKeepaKey(keepaKey);
      setSavedMessage('Settings saved successfully');
      setLoading(false);

      setTimeout(() => setSavedMessage(''), 3000);
    }, 500);
  };

  const resetSettings = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setEmail(user?.email || '');
    setKeepaKey(db.getKeepaKey());
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* PAGE HEADER */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold text-slate-900">
          Settings & Fee Configuration
        </h1>
        <p className="mt-1 text-sm text-slate-500 max-w-2xl">
          Manage your account details and API integrations. All values are stored securely in your local browser.
        </p>
      </div>

      {/* SUCCESS MESSAGE */}
      {savedMessage && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          <CheckCircle className="w-4 h-4" />
          {savedMessage}
        </div>
      )}

      {/* SETTINGS CARD */}
      <Card className="p-6 space-y-8">
        {/* CARD HEADER */}
        <div className="border-b border-slate-200 pb-4">
          <h3 className="text-sm font-semibold text-slate-800">
            General Settings
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Account information and API configuration
          </p>
        </div>

        {/* ACCOUNT INFO */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <User className="w-4 h-4" />
            Account Information
          </div>

          <div>
            <Input
              label="Email Address"
              value={email}
              disabled
            />
            <p className="mt-1 text-xs text-slate-500">
              Contact support to update your email address.
            </p>
          </div>
        </div>

        {/* API CONFIG */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <KeyRound className="w-4 h-4" />
            API Configuration
          </div>

          <div>
            <Input
              label="Keepa API Key"
              type="password"
              value={keepaKey}
              onChange={(e) => setKeepaKey(e.target.value)}
              placeholder="Enter your Keepa API key"
            />
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5" />
              Stored locally. Never sent to external servers.
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-4 pt-4">
          <Button onClick={saveSettings} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>

          <button
            type="button"
            onClick={resetSettings}
            className="text-sm text-slate-500 hover:text-slate-700 transition"
          >
            Reset to last saved
          </button>
        </div>
      </Card>
    </div>
  );
};

export default UserSettings;
