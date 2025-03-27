import React, { useState, useEffect } from 'react';
import { useKalyscanApi } from '../../blockchain/hooks/useKalyscanApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

interface PriceDisplay {
  coin_price: string | null;
  formatted_price: string;
}

interface StatsResponse {
  coin_price?: string;
  coin_market_cap?: string;
  coin_circulating_supply?: string;
  total_supply?: string;
  [key: string]: any;
}

const ApiTest = () => {
  const [isTestnet, setIsTestnet] = useState(true);
  const [selectedEndpoint, setSelectedEndpoint] = useState('/v2/stats');
  const [priceDisplay, setPriceDisplay] = useState<PriceDisplay>({
    coin_price: null,
    formatted_price: 'Not available'
  });
  
  const { data, isLoading, error, refetch } = useKalyscanApi<StatsResponse>(selectedEndpoint, {}, isTestnet);

  const endpoints = [
    '/v2/stats',
    '/v2/tokens',
    '/api?module=account&action=balance&address=0x0000000000000000000000000000000000000000',
    '/api?module=stats&action=totalfees'
  ];

  // Extract and format price from data when it changes
  useEffect(() => {
    if (data && selectedEndpoint === '/v2/stats') {
      try {
        const coin_price = data.coin_price;
        const coin_market_cap = data.coin_market_cap;
        const coin_circulating_supply = data.coin_circulating_supply;
        
        console.log('Price data debug:');
        console.log(`- coin_price: ${coin_price}`);
        console.log(`- coin_market_cap: ${coin_market_cap}`);
        console.log(`- coin_circulating_supply: ${coin_circulating_supply}`);
        
        if (coin_price) {
          const priceValue = Number(coin_price);
          console.log(`- Parsed price value: ${priceValue}`);
          
          let formatted_price;
          if (priceValue < 0.1) {
            formatted_price = `$${priceValue.toFixed(6)}`;
          } else if (priceValue < 1) {
            formatted_price = `$${priceValue.toFixed(4)}`;
          } else {
            formatted_price = `$${priceValue.toFixed(2)}`;
          }
          
          console.log(`- Formatted price: ${formatted_price}`);
            
          setPriceDisplay({
            coin_price,
            formatted_price
          });
        } else {
          console.log('- No price value found in API response');
          setPriceDisplay({
            coin_price: null,
            formatted_price: 'Price not available in API'
          });
        }
      } catch (err) {
        console.error('Error parsing price:', err);
        setPriceDisplay({
          coin_price: null,
          formatted_price: 'Error parsing price'
        });
      }
    }
  }, [data, selectedEndpoint]);

  const toggleNetwork = () => {
    setIsTestnet(!isTestnet);
  };

  const handleEndpointChange = (endpoint: string) => {
    setSelectedEndpoint(endpoint);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">KalyScan API Test</h1>
      
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={toggleNetwork}>
          Network: {isTestnet ? 'Testnet' : 'Mainnet'}
        </Button>
        <Button onClick={refetch} variant="outline" className="flex items-center gap-1">
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {selectedEndpoint === '/v2/stats' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>KLC Price Test</CardTitle>
            <CardDescription>Testing direct price from API</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">Raw Price Value</h3>
                <p className="text-2xl font-bold">{priceDisplay.coin_price || 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Formatted Price</h3>
                <p className="text-2xl font-bold">{priceDisplay.formatted_price}</p>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-muted rounded-md">
              <h3 className="text-sm font-medium mb-2">Price Debug Info</h3>
              <p className="text-xs text-muted-foreground">
                Raw API price: {data?.coin_price || 'Not available'}<br />
                Market Cap: {data?.coin_market_cap || 'Not available'}<br />
                Circulating Supply: {data?.coin_circulating_supply || 'Not available'}<br />
                Total Supply: {data?.total_supply || 'Not available'}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Check console for detailed debug logs</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={endpoints[0]} className="w-full mb-8">
        <TabsList className="w-full mb-6 overflow-x-auto">
          {endpoints.map((endpoint) => (
            <TabsTrigger 
              key={endpoint} 
              value={endpoint}
              onClick={() => handleEndpointChange(endpoint)}
            >
              {endpoint.split('?')[0] || endpoint}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedEndpoint}>
          <Card>
            <CardHeader>
              <CardTitle>
                Response from {selectedEndpoint}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Error: {error.message}
                  </AlertDescription>
                </Alert>
              ) : (
                <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[500px]">
                  {JSON.stringify(data, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApiTest; 