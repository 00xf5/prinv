import { useState, useEffect } from 'react';

// Using a public exchange rate API to dynamically get the realistic NGN/USD rate
export function useExchangeRate() {
  const [rate, setRate] = useState<number>(1500); // Realistic fallback rate
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchRate = async () => {
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        if (mounted && data.rates && data.rates.NGN) {
          setRate(data.rates.NGN);
        }
      } catch (err) {
        console.error("Failed to fetch NGN exchange rate, falling back to default.", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchRate();
    return () => { mounted = false; };
  }, []);

  // Format USD cents directly into NGN string securely and uniformly
  const formatCentsToNGN = (cents: number): string => {
    const usdAmount = cents / 100;
    const ngnAmount = usdAmount * rate;
    return "₦" + ngnAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Format USD dollars directly to NGN string
  const formatDollarsToNGN = (dollars: number): string => {
    const ngnAmount = dollars * rate;
    return "₦" + ngnAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Format NGN amount directly directly to NGN string
  const formatNGNDirectly = (ngn: number): string => {
    return "₦" + ngn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return { rate, loading, formatCentsToNGN, formatDollarsToNGN, formatNGNDirectly };
}
