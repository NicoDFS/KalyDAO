import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import DaoOverview from "./home/DaoOverview";
import TokenInfo from "./home/TokenInfo";
import ActiveProposalsList from "./proposals/ActiveProposalsList";
import { ConnectButton } from '@rainbow-me/rainbowkit';

const Home = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <section className="text-center py-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Welcome to KalyChain DAO
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            A decentralized governance platform for the KalyChain ecosystem.
            Connect your wallet to participate in proposals and shape the future
            of KalyChain.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <ConnectButton />
            <Link to="/proposals">
              <Button variant="outline" size="lg">
                View Proposals
              </Button>
            </Link>
          </div>
        </section>

        {/* DAO Overview Section */}
        <section className="py-6">
          <DaoOverview />
        </section>

        {/* Token Information Section */}
        <section className="py-6">
          <TokenInfo />
        </section>

        {/* Active Proposals Section */}
        <section className="py-6">
          <ActiveProposalsList title="Active Proposals" showFilters={false} limit={3} />
        </section>

        {/* Call to Action */}
        <section className="bg-primary/5 rounded-xl p-8 text-center my-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to participate in governance?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-6">
            Connect your wallet to start voting on proposals or create your own.
            Your KLC tokens represent your voting power in the DAO.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <ConnectButton />
            <Link to="/proposals/create">
              <Button variant="outline" size="lg">
                Create Proposal
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                KalyChain DAO
              </h3>
              <p className="text-gray-600 mt-1">
                Decentralized governance for all
              </p>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-600 hover:text-primary">
                Documentation
              </a>
              <a href="#" className="text-gray-600 hover:text-primary">
                GitHub
              </a>
              <a href="#" className="text-gray-600 hover:text-primary">
                Community
              </a>
              <a href="#" className="text-gray-600 hover:text-primary">
                Blog
              </a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100 text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} KalyChain DAO. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
