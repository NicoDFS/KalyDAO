import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getKalyscanApiUrl } from './useKalyscanApi';

export interface TokenData {
  totalSupply: string;
  circulatingSupply: string;
  currentPrice: string;
  marketCap: string;
  governancePower?: number;
  priceChange: {
    value: number;
    isPositive: boolean;
  };
  volume24h?: string;
  allTimeHigh?: string;
  allTimeLow?: string;
  // Raw values for calculations
  rawTotalSupply: number;
  rawCirculatingSupply: number;
  lastUpdated: Date;
}

// KLC Token constants based on CMC data
const KLC_MAX_SUPPLY = 7000000000; // 7 billion
const KLC_DEFAULT_CIRCULATING = 3570000000; // 3.57 billion from CMC
const DEFAULT_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper function to format large numbers
const formatNumber = (num: number, decimals = 2): string => {
  if (num >= 1000000000) {
    return `$${(num / 1000000000).toFixed(decimals)}B`;
  } else if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(decimals)}M`;
  } else if (num >= 1000) {
    return `$${(num / 1000).toFixed(decimals)}K`;
  } else {
    return `$${num.toFixed(decimals)}`;
  }
};

// Helper function to format token amounts in more readable units
const formatTokenAmount = (amount: number): string => {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(2)}B KLC`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)}M KLC`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(2)}K KLC`;
  } else {
    return `${amount.toFixed(2)} KLC`;
  }
};

interface UseTokenDataOptions {
  refreshInterval?: number;  // Refresh interval in milliseconds
  autoRefresh?: boolean;     // Whether to automatically refresh
}

export function useTokenData(
  isTestnet = false,
  options: UseTokenDataOptions = {}
): {
  tokenData: TokenData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  lastRefreshTime: Date | null;
} {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  
  // Set default options
  const { 
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    autoRefresh = true
  } = options;
  
  // Use a ref to store the interval ID so it persists across renders
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const fetchTokenData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Set the last refresh time
      const refreshTime = new Date();
      setLastRefreshTime(refreshTime);
      
      // Base URL for API calls
      const baseUrl = getKalyscanApiUrl(isTestnet);
      
      console.log(`Fetching token data from: ${baseUrl}/v2/stats at ${refreshTime.toLocaleTimeString()}`);
      
      // Fetch on-chain stats from KalyScan API
      const statsResponse = await axios.get(`${baseUrl}/v2/stats`);
      console.log("Stats API response:", statsResponse.data);
      
      // Try to get circulating supply directly from token info
      let circulatingFromTokenInfo = null;
      try {
        const tokenResponse = await axios.get(`${baseUrl}/v2/tokens`);
        console.log("Token API response:", tokenResponse.data);
        
        // Look for KLC token in the tokens list
        if (Array.isArray(tokenResponse.data)) {
          const klcToken = tokenResponse.data.find((token: any) => 
            token.symbol === 'KLC' || token.name === 'KalyChain'
          );
          
          if (klcToken && klcToken.circulating_supply) {
            circulatingFromTokenInfo = Number(klcToken.circulating_supply);
            console.log(`Found circulating supply from token info: ${circulatingFromTokenInfo}`);
          }
        }
      } catch (err) {
        console.warn("Could not fetch token info for circulating supply:", err);
      }
      
      // Try to fetch CMC data for the latest price change
      let cmcPriceChange = 0.08; // Default fallback
      let cmcVolume = 40070; // Default fallback
      let cmcAtl = 0.001203; // Default fallback
      let cmcAth = 0.5844; // Default fallback
      
      try {
        // Try to get updated price change from CMC or another reliable source
        const cmcProxyUrl = 'https://api.coingecko.com/api/v3/coins/kalycoin';
        const cmcResponse = await axios.get(cmcProxyUrl);
        
        if (cmcResponse.data && cmcResponse.data.market_data) {
          const marketData = cmcResponse.data.market_data;
          
          // Get 24h price change percentage
          if (marketData.price_change_percentage_24h !== undefined) {
            cmcPriceChange = Math.abs(marketData.price_change_percentage_24h);
            console.log(`✅ Successfully fetched live CMC price change: ${cmcPriceChange}% (raw value: ${marketData.price_change_percentage_24h})`);
          } else {
            console.warn('❌ CoinGecko API did not return price_change_percentage_24h, using fallback value');
          }
          
          // Get 24h volume
          if (marketData.total_volume && marketData.total_volume.usd) {
            cmcVolume = marketData.total_volume.usd;
            console.log(`Got CMC volume: $${cmcVolume}`);
          }
          
          // Get ATH and ATL if available
          if (marketData.ath && marketData.ath.usd) {
            cmcAth = marketData.ath.usd;
          }
          
          if (marketData.atl && marketData.atl.usd) {
            cmcAtl = marketData.atl.usd;
          }
        }
      } catch (err) {
        console.warn("Could not fetch CMC data, using fallback values:", err);
      }
      
      // CMC data for KalyChain for missing fields (from https://coinmarketcap.com/currencies/kalycoin/)
      const cmcData = {
        price_change_24h_percent: cmcPriceChange, // Use the dynamically fetched value
        volume_24h: cmcVolume, 
        ath: cmcAth, 
        atl: cmcAtl, 
        current_price: 0.001214 
      };
      
      // Extract data from the API response
      const statsData = statsResponse.data || {};
      const coin_price = statsData.coin_price;
      const coin_market_cap = statsData.coin_market_cap;
      const coin_circulating_supply = statsData.coin_circulating_supply;
      const totalSupplyValue = statsData.total_supply;
      
      console.log(`API coin_price: ${coin_price}`);
      console.log(`API coin_market_cap: ${coin_market_cap}`);
      console.log(`API coin_circulating_supply: ${coin_circulating_supply}`);
      
      // Extract and format data
      // Use API data for total supply if available, else fallback to CMC data
      const actualTotalSupply = totalSupplyValue 
        ? Number(totalSupplyValue) 
        : KLC_DEFAULT_CIRCULATING;
        
      // Format total supply in a more concise way
      const totalSupply = formatTokenAmount(actualTotalSupply) + ` / ${formatTokenAmount(KLC_MAX_SUPPLY)}`;
      
      // Try to get circulating supply from multiple sources in order of preference:
      // 1. Token info endpoint
      // 2. Stats endpoint
      // 3. CMC fallback value
      const actualCirculatingSupply = circulatingFromTokenInfo 
        ? circulatingFromTokenInfo 
        : coin_circulating_supply 
          ? Number(coin_circulating_supply) 
          : KLC_DEFAULT_CIRCULATING;
          
      const circulatingSupply = formatTokenAmount(actualCirculatingSupply);
      
      console.log(`Total supply: ${actualTotalSupply}, Circulating: ${actualCirculatingSupply}`);
      
      // Get price directly from API if available
      let priceValue: number;
      let currentPrice: string;
      
      if (coin_price && coin_price !== "0" && coin_price !== "0.0") {
        // Convert to dollars and format with more decimal places for small values
        priceValue = Number(coin_price);
        console.log(`Raw price value: ${priceValue}`);
        
        if (priceValue < 0.1) {
          currentPrice = `$${priceValue.toFixed(6)}`;
        } else if (priceValue < 1) {
          currentPrice = `$${priceValue.toFixed(4)}`;
        } else {
          currentPrice = `$${priceValue.toFixed(2)}`;
        }
        
        console.log(`Using API price: ${currentPrice}`);
      } else {
        // Use CMC price as fallback
        priceValue = cmcData.current_price;
        currentPrice = `$${priceValue.toFixed(6)}`;
        console.log(`Using CMC fallback price: ${currentPrice}`);
      }
      
      // Calculate market cap using price * circulating supply if not available from API
      let marketCapValue: number;
      
      if (coin_market_cap && coin_market_cap !== "0" && coin_market_cap !== "0.000000000") {
        marketCapValue = Number(coin_market_cap);
        console.log(`Using API market cap: ${marketCapValue}`);
      } else {
        // Calculate market cap using price * circulating supply
        marketCapValue = priceValue * actualCirculatingSupply;
        console.log(`Calculated market cap: ${marketCapValue} (${priceValue} * ${actualCirculatingSupply})`);
      }
      
      const marketCap = formatNumber(marketCapValue);
      console.log(`Formatted market cap: ${marketCap}`);
      
      // Use percentage change from CMC - use the dynamically fetched value
      const percentChange = cmcData.price_change_24h_percent;
      const isPositive = percentChange >= 0;
      
      console.log(`📊 Setting price change value: ${percentChange}%, isPositive: ${isPositive}`);
      
      // Update token data with all processed values
      setTokenData({
        totalSupply,
        circulatingSupply,
        currentPrice,
        marketCap,
        governancePower: 65, // This might come from a governance contract
        priceChange: {
          value: Math.abs(percentChange),
          isPositive
        },
        volume24h: formatNumber(cmcData.volume_24h),
        allTimeHigh: `$${cmcData.ath.toFixed(4)}`,
        allTimeLow: `$${cmcData.atl.toFixed(6)}`,
        rawTotalSupply: actualTotalSupply,
        rawCirculatingSupply: actualCirculatingSupply,
        lastUpdated: refreshTime
      });
      
    } catch (err) {
      console.error("Error fetching token data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Set up the refresh interval
  useEffect(() => {
    // Initial fetch
    fetchTokenData();
    
    // Set up interval for automatic refresh if enabled
    if (autoRefresh && refreshInterval > 0) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Create new interval
      intervalRef.current = setInterval(() => {
        console.log(`Auto-refreshing token data (interval: ${refreshInterval / 1000}s)`);
        fetchTokenData();
      }, refreshInterval);
      
      // Return cleanup function
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
    
    return undefined;
  }, [isTestnet, refreshInterval, autoRefresh]);

  return { 
    tokenData, 
    isLoading, 
    error, 
    refetch: fetchTokenData,
    lastRefreshTime
  };
} 