import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertCircle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CreateProposalProps {
  isWalletConnected?: boolean;
  userVotingPower?: number;
  minProposalThreshold?: number;
}

const formSchema = z.object({
  title: z
    .string()
    .min(10, {
      message: "Title must be at least 10 characters.",
    })
    .max(100, {
      message: "Title must not exceed 100 characters.",
    }),
  summary: z
    .string()
    .min(20, {
      message: "Summary must be at least 20 characters.",
    })
    .max(250, {
      message: "Summary must not exceed 250 characters.",
    }),
  description: z.string().min(100, {
    message: "Description must be at least 100 characters.",
  }),
  category: z.string({
    required_error: "Please select a category.",
  }),
  votingPeriod: z.string({
    required_error: "Please select a voting period.",
  }),
});

const CreateProposal = ({
  isWalletConnected = false,
  userVotingPower = 25000,
  minProposalThreshold = 50000,
}: CreateProposalProps) => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      summary: "",
      description: "",
      category: "",
      votingPeriod: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log(values);
    setIsSubmitting(false);

    // Navigate to proposals page after submission
    navigate("/proposals");
  };

  const hasEnoughVotingPower = userVotingPower >= minProposalThreshold;

  return (
    <div className="w-full max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Create New Proposal
        </h1>
        <p className="text-gray-600 mt-2">
          Submit a proposal for the KalyChain DAO to vote on. Proposals require
          a minimum of {minProposalThreshold.toLocaleString()} KLC voting power
          to create.
        </p>
      </div>

      {!isWalletConnected ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                Wallet Not Connected
              </h3>
              <p className="text-gray-500 mt-2 mb-4">
                You need to connect your wallet to create a proposal
              </p>
              <Button>Connect Wallet</Button>
            </div>
          </CardContent>
        </Card>
      ) : !hasEnoughVotingPower ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Insufficient Voting Power</AlertTitle>
          <AlertDescription>
            You need at least {minProposalThreshold.toLocaleString()} KLC voting
            power to create a proposal. You currently have{" "}
            {userVotingPower.toLocaleString()} KLC.
          </AlertDescription>
        </Alert>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Proposal Details</CardTitle>
                <CardDescription>
                  Provide the basic information about your proposal
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter a clear, concise title"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This will be displayed as the main title of your
                        proposal
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="summary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Summary</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provide a brief summary of your proposal"
                          {...field}
                          className="resize-none"
                          rows={2}
                        />
                      </FormControl>
                      <FormDescription>
                        A short summary that will appear in proposal listings
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="governance">Governance</SelectItem>
                          <SelectItem value="treasury">Treasury</SelectItem>
                          <SelectItem value="protocol">Protocol</SelectItem>
                          <SelectItem value="community">Community</SelectItem>
                          <SelectItem value="technical">Technical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The category helps organize proposals by their purpose
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="votingPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormLabel>Voting Period</FormLabel>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="w-80 text-sm">
                                The voting period determines how long the
                                proposal will be open for voting. Standard
                                periods are recommended for most proposals.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a voting period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="3days">
                            3 Days (Standard)
                          </SelectItem>
                          <SelectItem value="5days">5 Days</SelectItem>
                          <SelectItem value="7days">
                            7 Days (Extended)
                          </SelectItem>
                          <SelectItem value="14days">
                            14 Days (Major Changes)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Proposal Content</CardTitle>
                <CardDescription>
                  Provide detailed information about your proposal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detailed Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provide a detailed description of your proposal, including background, rationale, and expected outcomes"
                          {...field}
                          className="min-h-[200px]"
                        />
                      </FormControl>
                      <FormDescription>
                        You can use markdown formatting for better readability
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => navigate("/proposals")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Proposal"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Form>
      )}
    </div>
  );
};

export default CreateProposal;
