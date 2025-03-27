import { useState, useEffect } from 'react';
import axios from 'axios';

// Helper function to create the API URL based on environment
export const getKalyscanApiUrl = (isTestnet = false): string => {
  return isTestnet 
    ? 'https://testnet.kalyscan.io/api' 
    : 'https://kalyscan.io/api';
};

/**
 * A hook for testing a specific KalyScan API endpoint
 */
export function useKalyscanApi<T>(
  endpoint: string, 
  params: Record<string, any> = {}, 
  isTestnet = false
): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const baseUrl = getKalyscanApiUrl(isTestnet);
  
  const fetchData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.get(`${baseUrl}${endpoint}`, { params });
      setData(response.data);
    } catch (err) {
      console.error(`Error fetching from ${endpoint}:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [endpoint, isTestnet, JSON.stringify(params)]);

  return { data, isLoading, error, refetch: fetchData };
}

// Example usage:
// const { data, isLoading, error } = useKalyscanApi<StatsResponse>('/v2/stats', {}, true); 