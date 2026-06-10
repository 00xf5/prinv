import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Settings, Percent, Key, Search, Calculator, TrendingUp, Info, Activity } from 'lucide-react';
import { useExchangeRate } from '../../lib/useExchangeRate';

export function AdminSettings() {
  const [profitMargin, setProfitMargin] = useState('2.01'); // default 101%
  const [monnifyApiKey, setMonnifyApiKey] = useState('');
  const [monnifySecretKey, setMonnifySecretKey] = useState('');
  const [monnifyContractCode, setMonnifyContractCode] = useState('');
  const [loading, setLoading] = useState(true);

  // Selector and simulator states
  const { rate: exRate, formatCentsToNGN, formatDollarsToNGN } = useExchangeRate();
  const [countries, setCountries] = useState<any[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>('187'); // default US
  const [services, setServices] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [serviceMeta, setServiceMeta] = useState<Record<string, string>>({});
  const [serviceSearch, setServiceSearch] = useState('');
  const [loadingServices, setLoadingServices] = useState(false);

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

  // Fetch Grizzly countries list
  useEffect(() => {
    async function loadCountries() {
      try {
        const res = await fetch("/api/grizzly?action=getCountries");
        const data = await res.json();
        const cList = Object.keys(data).map(key => ({
          id: key,
          name: data[key].eng || data[key].rus || "Unknown"
        })).sort((a, b) => a.name.localeCompare(b.name));
        setCountries(cList);
        // Default to "USA" (grizzlyCountryId 12 or 187) or "Russia" (0) etc, if present
        const defaultCountry = cList.find(c => c.id === '187' || c.id === '12' || c.id === '0') || cList[0];
        if (defaultCountry) {
          setSelectedCountryId(defaultCountry.id);
        }
      } catch (err) {
        console.error("Failed to load countries in admin settings helper", err);
      }
    }
    loadCountries();
  }, []);

  // Fetch Grizzly services lists
  useEffect(() => {
    async function loadServiceMeta() {
      try {
        const res = await fetch("/api/grizzly?action=getServicesList");
        const data = await res.json();
        if (data?.services) {
          const meta: Record<string, string> = {};
          data.services.forEach((s: any) => {
            meta[s.code] = s.name;
          });
          setServiceMeta(meta);
        }
      } catch (err) {
        console.error("Failed to load service names metadata", err);
      }
    }
    loadServiceMeta();
  }, []);

  // Fetch Pricing based on country
  useEffect(() => {
    if (!selectedCountryId) return;
    async function loadPricing() {
      setLoadingServices(true);
      try {
        const res = await fetch(`/api/grizzly?action=getPrices&country=${selectedCountryId}`);
        const data = await res.json();
        const countryData = data[selectedCountryId];
        if (countryData) {
          const sList = Object.keys(countryData).map(key => ({
            id: key,
            name: serviceMeta[key] || key.toUpperCase(),
            cost: countryData[key].cost,
            count: countryData[key].count
          })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);
          setServices(sList);
          if (sList.length > 0) {
            setSelectedServiceId(sList[0].id);
          } else {
            setSelectedServiceId('');
          }
        } else {
          setServices([]);
          setSelectedServiceId('');
        }
      } catch (err) {
        console.error("Failed to fetch country rates", err);
      } finally {
        setLoadingServices(false);
      }
    }
    loadPricing();
  }, [selectedCountryId, serviceMeta]);

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

  // Live Math calculations and POV formatting
  const numericMargin = parseFloat(profitMargin) || 1.0;
  const activeService = services.find(s => s.id === selectedServiceId);
  const grizzlyCostUSD = activeService ? activeService.cost : 0; // Raw Grizzly API cost (presumably points matching USD equivalent value)

  // System markup formulas matching code exactly
  // Math.max(10, Math.ceil(grizzlyCostUSD * margin * 100))
  const calculatedClientCents = Math.max(10, Math.ceil(grizzlyCostUSD * numericMargin * 100));
  const calculatedClientUSD = calculatedClientCents / 100;

  // Converts USD costs dynamically into Nigerian Naira using current live exRate
  const nairaClientPrice = calculatedClientUSD * exRate;
  const nairaOriginalCost = grizzlyCostUSD * exRate;
  const netNairaProfit = nairaClientPrice - nairaOriginalCost;
  const markupPercent = nairaOriginalCost > 0 ? (netNairaProfit / nairaOriginalCost) * 100 : 0;

  // Filter services by live user search
  const filteredServices = services.filter(s => 
    s.id.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  if (loading) return <div className="text-white p-6">Loading settings...</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">System Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure global pricing rules and API variables.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side settings panels */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Percent className="w-5 h-5 text-indigo-400" />
              Pricing Configuration
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Profit Margin Multiplier
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Formula: Cost * Multiplier. E.g. 2.01 means charging 101% profit on top of cost.
                </p>
                <div className="relative">
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={profitMargin} 
                    onChange={(e) => setProfitMargin(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-white focus:ring-indigo-500 pr-10 font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-500">x</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              Monnify Credentials
            </h2>
            
            <div className="space-y-4">
               <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  API Key
                </label>
                <Input 
                  type="text" 
                  value={monnifyApiKey} 
                  onChange={(e) => setMonnifyApiKey(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-white focus:ring-indigo-500 text-xs font-mono"
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
                  className="bg-slate-950 border-slate-700 text-white focus:ring-indigo-500 text-xs font-mono"
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
                  className="bg-slate-950 border-slate-700 text-white focus:ring-indigo-500 text-xs font-mono"
                  placeholder="0123456789"
                />
              </div>
              
              <div className="pt-2">
                <Button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold transition-colors">
                  Save All Settings
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Simulator (Interactive Calculations Playground) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Calculator className="w-6 h-6 text-indigo-400" />
                <div>
                  <h2 className="text-lg font-bold text-white">Live Rate & Margin Playground</h2>
                  <p className="text-xs text-slate-400">Verifying costs and revenue structure in real time.</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-lg text-xs border border-slate-800 text-slate-300">
                <span className="font-sans font-bold text-emerald-400">USD to NGN:</span>
                <span className="font-mono font-bold">₦{exRate?.toLocaleString()} / $1</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  1. Select Country
                </label>
                <select
                  value={selectedCountryId}
                  onChange={(e) => {
                    setSelectedCountryId(e.target.value);
                    setServiceSearch('');
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                >
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Code {c.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  2. Search & Select Service
                </label>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    placeholder="Type to filter (e.g. WhatsApp, FB)"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-white pl-9 text-xs focus:ring-indigo-500"
                  />
                </div>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium max-h-32"
                  disabled={loadingServices}
                >
                  {loadingServices ? (
                    <option>Loading Services...</option>
                  ) : filteredServices.length === 0 ? (
                    <option>No active services found</option>
                  ) : (
                    filteredServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id}) — {s.count} available
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {loadingServices ? (
              <div className="py-12 text-center text-slate-400 text-sm font-medium">
                Fetching real-time Grizzly rates...
              </div>
            ) : activeService ? (
              <div className="space-y-6">
                {/* Visual calculation chain */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                  <div className="text-xs uppercase font-bold text-slate-450 tracking-wider flex items-center justify-between">
                    <span>Active Math Proof-Of-Concept (POC)</span>
                    <span className="text-indigo-400 font-mono lowercase">Grizzly → cents → naira</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800">
                    <div className="pt-2 md:pt-0">
                      <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Wholesale API Cost</p>
                      <p className="font-mono text-xl font-bold text-white mt-1">
                        ${grizzlyCostUSD.toFixed(2)} unit
                      </p>
                      <p className="text-slate-500 text-[10px] mt-0.5">Grizzly cost in USD points</p>
                    </div>

                    <div className="pt-3 md:pt-0 md:pl-4">
                      <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Pricing Math Formula</p>
                      <p className="font-mono text-md font-bold text-indigo-400 mt-2">
                        {grizzlyCostUSD.toFixed(2)} * {numericMargin} * 100
                      </p>
                      <p className="text-slate-400 text-[11px] font-semibold mt-0.5">
                        = {calculatedClientCents} Cents charged
                      </p>
                    </div>

                    <div className="pt-3 md:pt-0 md:pl-4">
                      <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Naira Sell Price</p>
                      <p className="font-mono text-xl font-black text-emerald-400 mt-1">
                        ₦{(nairaClientPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-slate-500 text-[10px] mt-0.5">({calculatedClientUSD.toFixed(2)} USD * rate)</p>
                    </div>
                  </div>
                </div>

                {/* Profit report summary card */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/5 blur-[50px] rounded-full pointer-events-none" />
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Unit Economics Report
                  </h3>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Original Grizzly NGN Equivalent cost:</span>
                      <span className="font-mono text-slate-300">
                        ₦{(nairaOriginalCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Total Charged to Customer:</span>
                      <span className="font-mono font-bold text-white">
                        ₦{(nairaClientPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm border-t border-dashed border-slate-800 pt-3">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        Net Profit Margin Multiplier Applied:
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold rounded">
                        +{markupPercent.toFixed(1)}% Markup
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-md border-t border-slate-800 pt-3">
                      <span className="text-indigo-300 font-bold">Estimated Net Profit per SMS:</span>
                      <span className="font-mono text-lg font-black text-emerald-400">
                        +₦{(netNairaProfit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 bg-indigo-500/5 rounded-lg border border-indigo-500/20 text-[11px] text-indigo-300">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
                  <p>
                    <strong>Heads up:</strong> The client list dynamically rounds cents upwards to the nearest integer using standard ceiling calculations (<code className="font-mono text-slate-200">Math.ceil</code>) and sets a minimum ceiling threshold of 10 cents to secure a positive balance profit flow against low-cost unit microtransactions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 border border-slate-800 border-dashed rounded-xl text-center text-slate-500 text-sm">
                No active service selected. Please pick a country with live numbers to begin calculations.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
