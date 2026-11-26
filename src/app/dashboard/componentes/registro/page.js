"use client";

import DashboardShell from "@/app/components/DashboardShell";
import RevisionesCrud from "@/app/components/componentes/RevisionesCrud";

export default function Page() {
  return (
    <DashboardShell selectedItemId="revisiones">
      <RevisionesCrud />
    </DashboardShell>
  );
}
