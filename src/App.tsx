import { Suspense } from "react";
import { useRoutes, Routes, Route } from "react-router-dom";
import Home from "./components/home";
import Layout from "./components/layout/Layout";
import ProposalsPage from "./components/proposals/ProposalsPage";
import ProposalDetail from "./components/proposals/ProposalDetail";
import CreateProposal from "./components/proposals/CreateProposal";
import { TokenDetailPage } from "./components/token";
import routes from "tempo-routes";

function App() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/proposals" element={<ProposalsPage />} />
            <Route path="/proposals/:id" element={<ProposalDetail />} />
            <Route path="/create-proposal" element={<CreateProposal />} />
            <Route path="/token" element={<TokenDetailPage />} />
          </Route>
        </Routes>
        {import.meta.env.VITE_TEMPO === "true" && useRoutes(routes)}
      </>
    </Suspense>
  );
}

export default App;
