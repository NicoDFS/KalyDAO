import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Users,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAccount, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CONTRACT_ADDRESSES_BY_NETWORK } from '@/blockchain/contracts/addresses';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProposalDetailProps {
  minProposalThreshold?: number;
}

const ProposalDetail = ({
  minProposalThreshold = 50000,
}: ProposalDetailProps) => {
  const { id } = useParams<{ id: string }>();
  const [userVote, setUserVote] = useState<"for" | "against" | null>(null);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [voteDirection, setVoteDirection] = useState<"for" | "against">("for");
  
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address,
    token: CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNANCE_TOKEN,
  });

  const userVotingPower = Number(balance?.formatted || 0);

  // Mock proposal data - in a real app, you would fetch this based on the ID
  const proposal = {
    id: id || "proposal-1",
    title: "Increase Developer Fund Allocation",
    description:
      "This proposal aims to increase the allocation of funds for the developer ecosystem by 5% to attract more builders to KalyChain. The current allocation is 10% of the treasury, and this proposal would increase it to 15%.",
    fullDescription: `<p>The KalyChain ecosystem needs more developers to build applications and infrastructure. By increasing the developer fund allocation, we can:</p>
    <ul>
      <li>Offer more competitive grants to promising projects</li>
      <li>Fund hackathons and developer education programs</li>
      <li>Provide ongoing support for existing projects that show traction</li>
      <li>Establish a developer advocacy program to attract talent from other chains</li>
    </ul>
    <p>The increased allocation would come from the existing treasury reserves and would not require any new token issuance. The funds would be managed by the existing developer committee, with quarterly reports provided to the DAO.</p>`,
    proposer: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    proposedAt: "2023-05-15T10:30:00Z",
    votingEnds: "2023-05-22T10:30:00Z",
    votesFor: 1250000,
    votesAgainst: 450000,
    totalVotes: 2000000,
    timeRemaining: "2 days 4 hours",
    status: "active",
    quorum: 1000000,
    discussions: [
      {
        author: "0x1234...5678",
        authorName: "kaly_whale",
        content:
          "I support this proposal as it will help grow our ecosystem faster.",
        timestamp: "2023-05-16T14:22:00Z",
      },
      {
        author: "0x8765...4321",
        authorName: "validator_node_01",
        content:
          "While I agree with the goal, I think 5% is too much at once. Maybe we should start with 2-3%?",
        timestamp: "2023-05-17T09:15:00Z",
      },
      {
        author: "0x7Fc6...DDaE9",
        authorName: "proposer",
        content:
          "Thanks for the feedback. The 5% increase is based on comparable ecosystems that have seen success with similar allocations.",
        timestamp: "2023-05-17T11:30:00Z",
      },
    ],
  };

  // Calculate voting percentages
  const forPercentage =
    Math.round((proposal.votesFor / proposal.totalVotes) * 100) || 0;
  const againstPercentage =
    Math.round((proposal.votesAgainst / proposal.totalVotes) * 100) || 0;

  // Format vote numbers
  const formatNumber = (num: number) => {
    return num >= 1000000
      ? `${(num / 1000000).toFixed(1)}M`
      : num >= 1000
        ? `${(num / 1000).toFixed(1)}K`
        : num.toString();
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Handle vote
  const handleVote = (direction: "for" | "against") => {
    setVoteDirection(direction);
    setShowVoteDialog(true);
  };

  const confirmVote = () => {
    setUserVote(voteDirection);
    setShowVoteDialog(false);
    // In a real app, you would send the vote to the blockchain here
  };

  // Status badge color
  const getStatusColor = () => {
    switch (proposal.status) {
      case "active":
        return "bg-blue-100 text-blue-800";
      case "passed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-sm">
      {/* Back button */}
      <Link
        to="/proposals"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Proposals
      </Link>

      {/* Proposal header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <h1 className="text-2xl font-bold text-gray-900">{proposal.title}</h1>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}
          >
            {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
          </span>
        </div>
        <p className="text-gray-600 mt-2">{proposal.description}</p>
      </div>

      {/* Proposal metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="h-4 w-4 mr-2" />
          <span>Proposed: {formatDate(proposal.proposedAt)}</span>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="h-4 w-4 mr-2" />
          <span>Voting Ends: {formatDate(proposal.votingEnds)}</span>
        </div>
      </div>

      {/* Voting progress */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Voting Progress</h3>
            <div>
              <div className="flex justify-between mb-1 text-sm">
                <div className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4 text-green-600" />
                  <span>
                    {formatNumber(proposal.votesFor)} ({forPercentage}%)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <ThumbsDown className="h-4 w-4 text-red-600" />
                  <span>
                    {formatNumber(proposal.votesAgainst)} ({againstPercentage}%)
                  </span>
                </div>
              </div>
              <Progress value={forPercentage} className="h-2" />
            </div>

            <div className="flex justify-between text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{formatNumber(proposal.totalVotes)} total votes</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                <span>Quorum: {formatNumber(proposal.quorum)}</span>
              </div>
            </div>

            {/* Voting buttons */}
            {proposal.status === "active" && (
              <div className="pt-4">
                {isConnected ? (
                  userVote ? (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <p className="text-sm text-gray-600">
                        You voted {userVote === "for" ? "FOR" : "AGAINST"} this
                        proposal with {formatNumber(userVotingPower)} voting
                        power.
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <Button
                        onClick={() => handleVote("for")}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Vote For
                      </Button>
                      <Button
                        onClick={() => handleVote("against")}
                        variant="destructive"
                        className="flex-1"
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Vote Against
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="bg-gray-50 p-4 rounded-md text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      Connect your wallet to vote on this proposal
                    </p>
                    <ConnectButton />
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Proposal details tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="discussions">
            Discussions ({proposal.discussions.length})
          </TabsTrigger>
          <TabsTrigger value="history">Vote History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-6">
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: proposal.fullDescription }}
          />
        </TabsContent>
        <TabsContent value="discussions" className="mt-6">
          <div className="space-y-4">
            {proposal.discussions.map((discussion, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-md">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{discussion.authorName}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(discussion.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm">{discussion.content}</p>
              </div>
            ))}
            {isConnected ? (
              <div className="pt-4">
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md text-sm"
                  rows={3}
                  placeholder="Add your thoughts to the discussion..."
                />
                <div className="flex justify-end mt-2">
                  <Button size="sm">Post Comment</Button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-md text-center mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  Connect your wallet to join the discussion
                </p>
                <ConnectButton />
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">0x7Fc6...DDaE9</span>
                  <span className="ml-2 text-green-600 font-medium">
                    Voted FOR
                  </span>
                </div>
                <span className="text-sm">
                  {formatNumber(100000)} voting power
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {new Date("2023-05-16T10:30:00Z").toLocaleString()}
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">0x1234...5678</span>
                  <span className="ml-2 text-green-600 font-medium">
                    Voted FOR
                  </span>
                </div>
                <span className="text-sm">
                  {formatNumber(250000)} voting power
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {new Date("2023-05-16T11:45:00Z").toLocaleString()}
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">0x8765...4321</span>
                  <span className="ml-2 text-red-600 font-medium">
                    Voted AGAINST
                  </span>
                </div>
                <span className="text-sm">
                  {formatNumber(150000)} voting power
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {new Date("2023-05-17T09:15:00Z").toLocaleString()}
              </span>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Vote confirmation dialog */}
      <AlertDialog open={showVoteDialog} onOpenChange={setShowVoteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Your Vote</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to vote {voteDirection.toUpperCase()} this proposal
              with {formatNumber(userVotingPower)} voting power. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVote}>
              Confirm Vote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProposalDetail;
