"use client";

import DashboardShell from "@/app/components/DashboardShell";
import SorteosCrud from "@/app/components/sorteos/SorteosCrud";

export default function Page() {
  return (
    <DashboardShell selectedItemId="sorteos">
      <SorteosCrud />
    </DashboardShell>
  );
}
