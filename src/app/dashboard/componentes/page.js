"use client";

import DashboardShell from "@/app/components/DashboardShell";
import ComponentesCrud from "@/app/components/componentes/ComponentesCrud";

export default function Page() {
  return (
    <DashboardShell selectedItemId="catalogo">
      <ComponentesCrud />
    </DashboardShell>
  );
}
