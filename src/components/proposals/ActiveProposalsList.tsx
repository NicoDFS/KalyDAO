import React, { useState } from "react";
import { Search, Filter, ArrowUpDown } from "lucide-react";
import ProposalCard from "./ProposalCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Proposal {
  id: string;
  title: string;
  description: string;
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  timeRemaining: string;
  status: "active" | "passed" | "failed" | "pending";
}

interface ActiveProposalsListProps {
  proposals?: Proposal[];
  title?: string;
  showFilters?: boolean;
}

const ActiveProposalsList = ({
  proposals = [
    {
      id: "proposal-1",
      title: "Increase Developer Fund Allocation",
      description:
        "Proposal to increase the allocation of funds for the developer ecosystem by 5% to attract more builders to KalyChain.",
      votesFor: 1250000,
      votesAgainst: 450000,
      totalVotes: 2000000,
      timeRemaining: "2 days 4 hours",
      status: "active",
    },
    {
      id: "proposal-2",
      title: "Implement Token Burning Mechanism",
      description:
        "Proposal to implement a token burning mechanism to reduce total supply and potentially increase token value over time.",
      votesFor: 980000,
      votesAgainst: 320000,
      totalVotes: 1500000,
      timeRemaining: "1 day 12 hours",
      status: "active",
    },
    {
      id: "proposal-3",
      title: "Expand Validator Node Requirements",
      description:
        "Proposal to modify the requirements for running a validator node to improve network decentralization.",
      votesFor: 750000,
      votesAgainst: 650000,
      totalVotes: 1800000,
      timeRemaining: "3 days 8 hours",
      status: "active",
    },
  ],
  title = "Active Proposals",
  showFilters = true,
}: ActiveProposalsListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "mostVotes">(
    "newest",
  );

  // Filter proposals based on search term and status
  const filteredProposals = proposals.filter((proposal) => {
    const matchesSearch =
      proposal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposal.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || proposal.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Sort proposals based on sort order
  const sortedProposals = [...filteredProposals].sort((a, b) => {
    if (sortOrder === "newest") {
      return parseInt(b.id.split("-")[1]) - parseInt(a.id.split("-")[1]);
    } else if (sortOrder === "oldest") {
      return parseInt(a.id.split("-")[1]) - parseInt(b.id.split("-")[1]);
    } else {
      // mostVotes
      return b.totalVotes - a.totalVotes;
    }
  });

  return (
    <div className="w-full max-w-7xl mx-auto bg-white p-6 rounded-lg shadow-sm">
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <Button variant="outline" className="hidden sm:flex">
            View All Proposals
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search proposals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortOrder("newest")}>
                    Newest First
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder("oldest")}>
                    Oldest First
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder("mostVotes")}>
                    Most Votes
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {sortedProposals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                id={proposal.id}
                title={proposal.title}
                description={proposal.description}
                votesFor={proposal.votesFor}
                votesAgainst={proposal.votesAgainst}
                totalVotes={proposal.totalVotes}
                timeRemaining={proposal.timeRemaining}
                status={proposal.status}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Filter className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              No proposals found
            </h3>
            <p className="text-gray-500 mt-2">
              {searchTerm
                ? "Try adjusting your search or filters"
                : "There are no active proposals at this time"}
            </p>
          </div>
        )}

        <div className="flex justify-center sm:hidden mt-4">
          <Button variant="outline" className="w-full sm:w-auto">
            View All Proposals
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActiveProposalsList;
