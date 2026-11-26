import { NextResponse } from "next/server";
import { incomingDb } from "@/libs/incoming_db";
import { resolverMuestra } from "@/libs/aql_muestra";

function bad(message, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request) {
  const connection = await incomingDb.getConnection();
  try {
    const params = request.nextUrl.searchParams;
    const componenteId = Number(params.get("componente_id"));
    if (!Number.isInteger(componenteId) || componenteId < 1) {
      return bad("Selecciona un componente");
    }
    const data = await resolverMuestra(
      connection,
      componenteId,
      params.get("tamano_lote"),
    );
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    if (error.isValidation) return bad(error.message);
    console.error("/api/componentes/muestra:", error);
    return bad("No se pudo calcular el tamaño de muestra", 500);
  } finally {
    connection.release();
  }
}
