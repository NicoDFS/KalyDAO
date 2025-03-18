import React from "react";
import { Outlet } from "react-router-dom";

const ProposalsLayout = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <Outlet />
    </div>
  );
};

export default ProposalsLayout;
