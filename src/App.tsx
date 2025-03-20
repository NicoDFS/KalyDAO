import { Suspense } from "react";
import { useRoutes, Routes, Route } from "react-router-dom";
import Home from "./components/home";
import Layout from "./components/layout/Layout";
import ProposalsPage from "./components/proposals/ProposalsPage";
import ProposalDetail from "./components/proposals/ProposalDetail";
import CreateProposal from "./components/proposals/CreateProposal";
import { TokenDetailPage } from "./components/token";
import WrapKLC from "./components/wrap/WrapKLC";
import routes from "tempo-routes";
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './blockchain/config/wagmi';
import '@rainbow-me/rainbowkit/styles.css';
import BlockWatcher from './components/BlockWatcher';

// Create a client for TanStack Query
const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Suspense fallback={<p>Loading...</p>}>
            <>
              <BlockWatcher />
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/proposals" element={<ProposalsPage />} />
                  <Route path="/proposals/:id" element={<ProposalDetail />} />
                  <Route path="/create-proposal" element={<CreateProposal />} />
                  <Route path="/token" element={<TokenDetailPage />} />
                  <Route path="/wrap" element={<WrapKLC />} />
                </Route>
              </Routes>
              {import.meta.env.VITE_TEMPO === "true" && useRoutes(routes)}
            </>
          </Suspense>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
