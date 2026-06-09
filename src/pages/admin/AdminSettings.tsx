import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Settings, Percent, Key } from 'lucide-react';

export function AdminSettings() {
  const [profitMargin, setProfitMargin] = useState('2.01'); // default 101%
  const [monnifyApiKey, setMonnifyApiKey] = useState('');
  const [monnifySecretKey, setMonnifySecretKey] = useState('');
  const [monnifyContractCode, setMonnifyContractCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const docRef = doc(db, 'system', 'settings');
        const d = await getDoc(docRef);
        if (d.exists()) {
          const data = d.data();
          if (data.profitMargin) setProfitMargin(data.profitMargin.toString());
          if (data.monnifyApiKey) setMonnifyApiKey(data.monnifyApiKey);
          if (data.monnifySecretKey) setMonnifySecretKey(data.monnifySecretKey);
          if (data.monnifyContractCode) setMonnifyContractCode(data.monnifyContractCode);
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    const margin = parseFloat(profitMargin);
    if (isNaN(margin) || margin < 1) {
      toast.error('Invalid profit margin');
      return;
    }
    try {
      await setDoc(doc(db, 'system', 'settings'), { 
        profitMargin: margin,
        monnifyApiKey,
        monnifySecretKey,
        monnifyContractCode
      }, { merge: true });
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error('Failed to save settings');
    }
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">System Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure global pricing rules and API variables.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
          <Percent className="w-5 h-5 text-indigo-400" />
          Pricing Configuration
        </h2>
        
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Profit Margin Multiplier
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Example: 2.01 means 101% profit + original cost.
            </p>
            <Input 
              type="number" 
              step="0.01" 
              value={profitMargin} 
              onChange={(e) => setProfitMargin(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white focus:ring-indigo-500 max-w-[200px]"
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
          <Key className="w-5 h-5 text-indigo-400" />
          Monnify Checkout API Credentials
        </h2>
        
        <div className="space-y-4 max-w-md">
           <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              API Key
            </label>
            <Input 
              type="text" 
              value={monnifyApiKey} 
              onChange={(e) => setMonnifyApiKey(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white focus:ring-indigo-500"
              placeholder="MK_PROD_XXXXXXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Secret Key
            </label>
            <Input 
              type="password" 
              value={monnifySecretKey} 
              onChange={(e) => setMonnifySecretKey(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white focus:ring-indigo-500"
              placeholder="8XXXXXXXXXXXXXXXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Contract Code
            </label>
            <Input 
              type="text" 
              value={monnifyContractCode} 
              onChange={(e) => setMonnifyContractCode(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white focus:ring-indigo-500"
              placeholder="0123456789"
            />
          </div>
          
          <div className="pt-4">
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
