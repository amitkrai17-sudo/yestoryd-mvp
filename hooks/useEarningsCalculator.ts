import { useState, useEffect } from 'react';

interface ProductEarnings {
  name: string;
  slug: string;
  price: number;
  sessions: number;
  coach_earnings_own_lead: number;
  coach_earnings_platform_lead: number;
  per_session_own_lead: number;
  per_session_platform_lead: number;
}

interface EarningsData {
  products: ProductEarnings[];
  split_config: {
    lead_cost_percent: number;
    coach_cost_percent: number;
    platform_fee_percent: number;
    own_lead_total_percent: number;
  };
  scenarios: {
    students_per_month: number[];
    earnings: number[];
  };
}

export function useEarningsCalculator() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEarnings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/coach/earnings-calculator');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to load earnings data');
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  return { data, isLoading, error, refetch: fetchEarnings };
}
