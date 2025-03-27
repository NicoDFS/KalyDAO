import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Progress } from "../ui/progress";
import { Separator } from "../ui/separator";
import {
  ArrowUpRight,
  Coins,
  TrendingUp,
  Users,
  BarChart3,
  Clock,
  ExternalLink,
  Activity,
  PieChart,
  Wallet,
  Shield,
  Loader2,
  RefreshCw,
  Info,
} from "lucide-react";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useTokenData } from "../../blockchain/hooks/useTokenData";
import { Alert, AlertDescription } from "../ui/alert";

interface Transaction {
  hash: string;
  type: string;
  amount: string;
  time: string;
}

interface TokenDistributionItem {
  category: string;
  percentage: number;
}

const MAX_SUPPLY = 7000000000; // 7 billion KLC

const TokenDetailPage = () => {
  // Use a shorter refresh interval for the detail page (2 minutes)
  const { tokenData, isLoading, error, refetch, lastRefreshTime } = useTokenData(true, {
    refreshInterval: 2 * 60 * 1000, // 2 minutes
    autoRefresh: true
  });
  
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [tokenDistribution, setTokenDistribution] = useState<TokenDistributionItem[]>([
    { category: "Circulating Supply", percentage: 51 },
    { category: "Team & Advisors", percentage: 15 },
    { category: "Treasury", percentage: 10 },
    { category: "Ecosystem Growth", percentage: 24 },
  ]);

  // Calculate circulating percentage directly using raw values
  const circulatingPercentage = useMemo(() => {
    if (!tokenData) return 51; // Default from CMC
    return Math.round((tokenData.rawCirculatingSupply / MAX_SUPPLY) * 100);
  }, [tokenData]);
  
  // Format percentage for more readability
  const circulatingRatio = useMemo(() => {
    if (!tokenData) return "3.57B / 7B";
    const circulating = (tokenData.rawCirculatingSupply / 1000000000).toFixed(2);
    const max = (MAX_SUPPLY / 1000000000).toFixed(1);
    return `${circulating}B / ${max}B`;
  }, [tokenData]);
  
  // Format the last update time
  const formattedUpdateTime = useMemo(() => {
    if (!lastRefreshTime) return "Never";
    return lastRefreshTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [lastRefreshTime]);

  // Dynamically update token distribution when data is loaded
  useEffect(() => {
    if (tokenData) {
      setTokenDistribution([
        { category: "Circulating Supply", percentage: circulatingPercentage },
        { category: "Team & Advisors", percentage: 15 },
        { category: "Treasury", percentage: 10 },
        { category: "Ecosystem Growth", percentage: 75 - circulatingPercentage },
      ]);
    }
  }, [circulatingPercentage]);

  // Fetch recent transactions
  useEffect(() => {
    const fetchRecentTransactions = async () => {
      // This would be replaced with an actual API call to kalyscan.io
      // For now, using mock data
      setRecentTransactions([
        {
          hash: "0x7a8b...3f2e",
          type: "Transfer",
          amount: "25,000 KLC",
          time: "2 hours ago",
        },
        {
          hash: "0x3d2c...9f7a",
          type: "Stake",
          amount: "10,000 KLC",
          time: "5 hours ago",
        },
        {
          hash: "0x1e9d...8c4b",
          type: "Governance Vote",
          amount: "5,000 KLC",
          time: "1 day ago",
        },
        {
          hash: "0x5f7e...2d1a",
          type: "Transfer",
          amount: "15,000 KLC",
          time: "2 days ago",
        },
      ]);
    };

    if (!isLoading && tokenData) {
      fetchRecentTransactions();
    }
  }, [isLoading, tokenData]);

  if (isLoading && !tokenData) {
    return (
      <div className="container mx-auto py-8 px-4 flex justify-center items-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading token data...</p>
        </div>
      </div>
    );
  }

  if (error && !tokenData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex flex-col">
            <span>Error loading token data: {error.message}</span>
            <Button 
              onClick={refetch} 
              variant="outline" 
              size="sm" 
              className="mt-4 self-start flex gap-2 items-center"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!tokenData) {
    return null;
  }

  const {
    totalSupply,
    circulatingSupply,
    currentPrice,
    marketCap,
    governancePower,
    priceChange,
    volume24h,
    allTimeHigh,
    allTimeLow,
  } = tokenData;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Coins className="h-8 w-8 text-primary" />
            KLC Token Details
          </h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive information about the KalyChain governance token
          </p>
        </div>
        <div className="flex gap-3">
          <div className="text-sm text-muted-foreground flex items-center mr-2">
            {isLoading ? (
              <Loader2 className="h-3 w-3 text-primary animate-spin mr-2" />
            ) : (
              <Clock className="h-3 w-3 mr-2" />
            )}
            <span>Last updated: {formattedUpdateTime}</span>
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Buy KLC
          </Button>
          <a
            href="https://kalyscan.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            View on KalyScan
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Current Price
            </div>
            <div className="flex items-center">
              <span className="text-3xl font-bold mr-2">
                {currentPrice}
              </span>
              <span
                className={`text-sm font-medium flex items-center ${priceChange.isPositive ? "text-green-500" : "text-red-500"}`}
              >
                {priceChange.isPositive ? "+" : "-"}
                {(priceChange.value).toFixed(2)}%
                <TrendingUp className="h-4 w-4 ml-1" />
                <span className="ml-1 bg-green-100 text-green-800 text-xs px-1 rounded-full">live</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Market Cap
            </div>
            <div className="text-3xl font-bold">
              {marketCap}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              24h Volume
            </div>
            <div className="text-3xl font-bold">
              {volume24h}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Circulating Supply
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold">
                {circulatingPercentage}%
              </span>
              <span className="text-sm text-muted-foreground">{circulatingRatio}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full mb-8">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="transactions">
            Recent Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Token Metrics
              </CardTitle>
              <CardDescription>
                Key statistics about the KLC token
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total Supply
                    </span>
                    <span className="font-medium">
                      {totalSupply}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Circulating Supply
                    </span>
                    <span className="font-medium">
                      {circulatingSupply}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      All-Time High
                    </span>
                    <span className="font-medium">
                      {allTimeHigh}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      All-Time Low
                    </span>
                    <span className="font-medium">
                      {allTimeLow}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">
                        Token Distribution
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {circulatingPercentage}% of Max Supply
                      </span>
                    </div>
                    <Progress value={circulatingPercentage} className="h-2" />
                  </div>

                  <div className="pt-4">
                    <h4 className="text-sm font-medium mb-2">
                      Token Utility
                    </h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <Shield className="h-4 w-4 text-primary mt-0.5" />
                        <span className="text-sm">
                          Governance voting rights
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Activity className="h-4 w-4 text-primary mt-0.5" />
                        <span className="text-sm">Staking rewards</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Wallet className="h-4 w-4 text-primary mt-0.5" />
                        <span className="text-sm">
                          Gas token
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Info className="h-4 w-4" />
                  Additional Market Data
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div className="p-3 rounded-md bg-muted/20">
                    <div className="text-xs text-muted-foreground mb-1">Market Rank</div>
                    <div className="font-medium">#4544</div>
                  </div>
                  <div className="p-3 rounded-md bg-muted/20">
                    <div className="text-xs text-muted-foreground mb-1">Volume/Market Cap Ratio</div>
                    <div className="font-medium">0.92%</div>
                  </div>
                  <div className="p-3 rounded-md bg-muted/20">
                    <div className="text-xs text-muted-foreground mb-1">All-Time High Date</div>
                    <div className="font-medium">Jun 09, 2022</div>
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <a
                    href="https://coinmarketcap.com/currencies/kalycoin/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center"
                  >
                    View on CoinMarketCap
                    <ArrowUpRight className="ml-1 h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center pt-2">
            <span className="text-sm text-muted-foreground">
              Data provided by KalyScan and CoinMarketCap
            </span>
            <div className="flex gap-3 items-center">
              <Button 
                onClick={refetch} 
                variant="ghost" 
                size="sm" 
                className="flex gap-1 items-center text-xs"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Refresh Data
              </Button>
              <a
                href="https://kalyscan.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary flex items-center"
              >
                Visit KalyScan
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </a>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Token Distribution
              </CardTitle>
              <CardDescription>
                How KLC tokens are distributed across different categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {tokenDistribution.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">
                        {item.category}
                      </span>
                      <span className="text-sm">{item.percentage}%</span>
                    </div>
                    <Progress value={item.percentage} className="h-2" />
                  </div>
                ))}

                <div className="pt-4 border-t mt-6">
                  <h4 className="text-sm font-medium mb-3">
                    Distribution Schedule
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    KLC tokens are released according to a predetermined
                    schedule to ensure long-term project sustainability and
                    fair distribution.
                  </p>
                  <a
                    href="https://kalyscan.io/token/distribution"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 bg-background text-primary-foreground hover:bg-accent ring-1 ring-inset ring-input gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Full Distribution Schedule
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Recent Transactions
              </CardTitle>
              <CardDescription>
                Latest KLC token transactions on the network
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTransactions.map((tx, index) => (
                  <div
                    key={index}
                    className={`flex justify-between items-center py-3 ${index !== recentTransactions.length - 1 ? "border-b" : ""}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://kalyscan.io/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-medium hover:underline"
                        >
                          {tx.hash}
                        </a>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {tx.time}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{tx.amount}</div>
                      <div className="text-sm text-muted-foreground">
                        {tx.type}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="pt-4 flex justify-center">
                  <a
                    href="https://kalyscan.io/token/transactions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-background text-primary-foreground hover:bg-accent ring-1 ring-inset ring-input gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View All Transactions on KalyScan
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="bg-muted/20 rounded-lg p-6 mb-8">
        <h3 className="text-xl font-bold mb-4">KLC Token Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="https://kalyscan.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <ExternalLink className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">KalyScan Explorer</div>
              <div className="text-sm text-muted-foreground">
                Track transactions and token metrics
              </div>
            </div>
          </a>
          <a
            href="https://coinmarketcap.com/currencies/kalycoin/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <ExternalLink className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">CoinMarketCap</div>
              <div className="text-sm text-muted-foreground">
                View market data and trading info
              </div>
            </div>
          </a>
          <a
            href="https://kalyscan.io/api-docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <ExternalLink className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">API Documentation</div>
              <div className="text-sm text-muted-foreground">
                Access KLC token data via API
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default TokenDetailPage;
