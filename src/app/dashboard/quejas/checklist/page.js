"use client";

import DashboardShell from "@/app/components/DashboardShell";
import QuejasCrud from "@/app/components/quejas/QuejasCrud";

export default function Page() {
  return (
    <DashboardShell selectedItemId="checklist">
      <QuejasCrud mode="checklist" />
    </DashboardShell>
  );
}
