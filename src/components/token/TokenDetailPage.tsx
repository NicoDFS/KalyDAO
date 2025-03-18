import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface TokenMetrics {
  totalSupply: string;
  currentPrice: string;
  marketCap: string;
  governancePower: number;
  priceChange: {
    value: number;
    isPositive: boolean;
  };
  volume24h: string;
  circulatingSupply: string;
  allTimeHigh: string;
  allTimeLow: string;
}

const TokenDetailPage = () => {
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics>({
    totalSupply: "10,000,000 KLC",
    currentPrice: "$2.45",
    marketCap: "$24,500,000",
    governancePower: 65,
    priceChange: { value: 5.2, isPositive: true },
    volume24h: "$1,245,000",
    circulatingSupply: "6,500,000 KLC",
    allTimeHigh: "$3.12",
    allTimeLow: "$0.87",
  });

  const [isLoading, setIsLoading] = useState(false);

  // This would be replaced with actual API call in production
  useEffect(() => {
    // Simulating API call to kalyscan.io
    // In production, you would fetch actual data from https://kalyscan.io/api
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const tokenDistribution = [
    { category: "Circulating Supply", percentage: 65 },
    { category: "Team & Advisors", percentage: 15 },
    { category: "Treasury", percentage: 10 },
    { category: "Ecosystem Growth", percentage: 10 },
  ];

  const recentTransactions = [
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
  ];

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
          <Button variant="outline" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Buy KLC
          </Button>
          <Button
            className="flex items-center gap-2"
            as="a"
            href="https://kalyscan.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            View on KalyScan
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="w-full h-40 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-white shadow-sm">
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Current Price
                </div>
                <div className="flex items-center">
                  <span className="text-3xl font-bold mr-2">
                    {tokenMetrics.currentPrice}
                  </span>
                  <span
                    className={`text-sm font-medium flex items-center ${tokenMetrics.priceChange.isPositive ? "text-green-500" : "text-red-500"}`}
                  >
                    {tokenMetrics.priceChange.isPositive ? "+" : "-"}
                    {tokenMetrics.priceChange.value}%
                    <TrendingUp className="h-4 w-4 ml-1" />
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
                  {tokenMetrics.marketCap}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm">
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  24h Volume
                </div>
                <div className="text-3xl font-bold">
                  {tokenMetrics.volume24h}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm">
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Governance Power
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-3xl font-bold">
                    {tokenMetrics.governancePower}%
                  </span>
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
                          {tokenMetrics.totalSupply}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Circulating Supply
                        </span>
                        <span className="font-medium">
                          {tokenMetrics.circulatingSupply}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          All-Time High
                        </span>
                        <span className="font-medium">
                          {tokenMetrics.allTimeHigh}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          All-Time Low
                        </span>
                        <span className="font-medium">
                          {tokenMetrics.allTimeLow}
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
                            65% Circulating
                          </span>
                        </div>
                        <Progress value={65} className="h-2" />
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
                              Transaction fee discounts
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between items-center pt-2">
                <span className="text-sm text-muted-foreground">
                  Data provided by KalyScan
                </span>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        as="a"
                        href="https://kalyscan.io/token/distribution"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Full Distribution Schedule
                      </Button>
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
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                        as="a"
                        href="https://kalyscan.io/token/transactions"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View All Transactions on KalyScan
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="bg-white shadow-sm mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Price History
              </CardTitle>
              <CardDescription>
                KLC token price over time (placeholder for chart)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full h-64 bg-muted/20 rounded-lg flex items-center justify-center">
                <div className="text-muted-foreground text-sm">
                  Price chart would be displayed here
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <a
                  href="https://kalyscan.io/token/price-chart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary flex items-center"
                >
                  View Interactive Chart on KalyScan
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </a>
              </div>
            </CardContent>
          </Card>

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
                href="https://kalyscan.io/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <ExternalLink className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">Documentation</div>
                  <div className="text-sm text-muted-foreground">
                    Learn about KLC token specifications
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
        </>
      )}
    </div>
  );
};

export default TokenDetailPage;
