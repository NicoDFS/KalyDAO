import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

const Layout = () => {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("0x1234...5678");
  const [walletBalance, setWalletBalance] = useState(1250.75);

  const handleConnectWallet = () => {
    // In a real app, this would connect to a wallet provider
    setIsWalletConnected(true);
  };

  const handleDisconnectWallet = () => {
    // In a real app, this would disconnect from the wallet provider
    setIsWalletConnected(false);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        isWalletConnected={isWalletConnected}
        walletAddress={walletAddress}
        walletBalance={walletBalance}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
      />
      <main className="flex-1 bg-gray-50">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
