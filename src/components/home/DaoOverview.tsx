import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Separator } from "../ui/separator";
import * as LucideIcons from "lucide-react";

interface DaoOverviewProps {
  title?: string;
  description?: string;
  statistics?: {
    totalMembers?: number;
    treasuryBalance?: number;
    proposalsCreated?: number;
    votesSubmitted?: number;
  };
}

const DaoOverview = ({
  title = "KalyChain DAO Governance",
  description = "KalyChain DAO is a decentralized autonomous organization built on the KalyChain blockchain. Members can propose, discuss, and vote on important decisions affecting the protocol using KLC tokens as voting power.",
  statistics = {
    totalMembers: 1245,
    treasuryBalance: 2500000,
    proposalsCreated: 87,
    votesSubmitted: 12453,
  },
}: DaoOverviewProps) => {
  return (
    <Card className="w-full bg-white shadow-md">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-900">
          {title}
        </CardTitle>
        <CardDescription className="text-gray-600 mt-2">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <StatCard
            title="Total Members"
            value={statistics.totalMembers?.toLocaleString() || "0"}
            icon="users"
          />
          <StatCard
            title="Treasury Balance"
            value={`${statistics.treasuryBalance?.toLocaleString() || "0"} KLC`}
            icon="landmark"
          />
          <StatCard
            title="Proposals Created"
            value={statistics.proposalsCreated?.toLocaleString() || "0"}
            icon="file-text"
          />
          <StatCard
            title="Votes Submitted"
            value={statistics.votesSubmitted?.toLocaleString() || "0"}
            icon="vote"
          />
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Governance Process
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ProcessStep
              number="01"
              title="Create Proposal"
              description="Any member with sufficient KLC tokens can create a governance proposal."
            />
            <ProcessStep
              number="02"
              title="Community Discussion"
              description="Proposals enter a discussion period where the community can provide feedback."
            />
            <ProcessStep
              number="03"
              title="Voting Period"
              description="Members vote using their KLC tokens, with one token equaling one vote."
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
}

const StatCard = ({ title, value, icon }: StatCardProps) => {
  // Get icon dynamically from lucide-react
  const LucideIcon = React.useMemo(() => {
    try {
      // Convert first character to uppercase for proper icon name format
      const iconName = icon.charAt(0).toUpperCase() + icon.slice(1);
      // Access the icon from the imported LucideIcons
      return (
        LucideIcons[iconName as keyof typeof LucideIcons] ||
        LucideIcons.CircleDashed
      );
    } catch (error) {
      // Fallback to a default icon if the specified one doesn't exist
      return LucideIcons.CircleDashed;
    }
  }, [icon]);

  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-primary/10 rounded-full">
          {LucideIcon && <LucideIcon className="h-5 w-5 text-primary" />}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
};

interface ProcessStepProps {
  number: string;
  title: string;
  description: string;
}

const ProcessStep = ({ number, title, description }: ProcessStepProps) => {
  return (
    <div className="flex space-x-4">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
          {number}
        </div>
      </div>
      <div>
        <h4 className="font-medium text-gray-800">{title}</h4>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
    </div>
  );
};

export default DaoOverview;
