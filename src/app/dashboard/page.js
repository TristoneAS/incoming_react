"use client";

import React from "react";
import DashboardShell from "@/app/components/DashboardShell";
import Dashboard from "@/app/components/Dashboard";

export default function DashboardPage() {
  return (
    <DashboardShell selectedItemId="inicio">
      <Dashboard />
    </DashboardShell>
  );
}
