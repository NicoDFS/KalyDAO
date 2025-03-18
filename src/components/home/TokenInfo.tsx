import React from "react";
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
import { ArrowUpRight, Coins, TrendingUp, Users } from "lucide-react";

interface TokenInfoProps {
  totalSupply?: string;
  currentPrice?: string;
  marketCap?: string;
  governancePower?: number;
  priceChange?: {
    value: number;
    isPositive: boolean;
  };
}

const TokenInfo = ({
  totalSupply = "10,000,000 KLC",
  currentPrice = "$2.45",
  marketCap = "$24,500,000",
  governancePower = 65,
  priceChange = { value: 5.2, isPositive: true },
}: TokenInfoProps) => {
  return (
    <Card className="w-full bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <Coins className="h-6 w-6 text-primary" />
          KLC Token Information
        </CardTitle>
        <CardDescription>
          Key metrics and information about the KalyChain governance token
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg border bg-background">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Total Supply
            </div>
            <div className="text-2xl font-bold">{totalSupply}</div>
          </div>

          <div className="p-4 rounded-lg border bg-background">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Current Price
            </div>
            <div className="flex items-center">
              <span className="text-2xl font-bold mr-2">{currentPrice}</span>
              <span
                className={`text-sm font-medium flex items-center ${priceChange.isPositive ? "text-green-500" : "text-red-500"}`}
              >
                {priceChange.isPositive ? "+" : "-"}
                {priceChange.value}%
                <TrendingUp className="h-4 w-4 ml-1" />
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-background">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Market Cap
            </div>
            <div className="text-2xl font-bold">{marketCap}</div>
          </div>

          <div className="p-4 rounded-lg border bg-background">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Governance Power
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{governancePower}%</span>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Token Distribution</span>
              <span className="text-sm text-muted-foreground">
                65% Circulating
              </span>
            </div>
            <Progress value={65} className="h-2" />
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-sm text-muted-foreground">
              Learn more about KLC tokenomics
            </span>
            <Link
              to="/token"
              className="text-sm font-medium text-primary flex items-center"
            >
              View Details
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TokenInfo;
