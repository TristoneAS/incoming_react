import { NextResponse } from "next/server";
import { query } from "@/libs/incoming_db";
import {
  readRevisionPdf,
  REVISION_PDF_FIELDS,
} from "@/libs/componentes_pdf";

export const runtime = "nodejs";

export async function GET(request) {
  const id = Number(request.nextUrl.searchParams.get("id"));
  const campo = request.nextUrl.searchParams.get("campo") || "";
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json(
      { success: false, error: "Id inválido" },
      { status: 400 },
    );
  }
  if (!REVISION_PDF_FIELDS.includes(campo)) {
    return NextResponse.json(
      { success: false, error: "El campo de evidencia no es válido" },
      { status: 400 },
    );
  }
  const file = await readRevisionPdf(id, campo, query);
  if (!file) {
    return NextResponse.json(
      { success: false, error: "No se encontró la evidencia PDF" },
      { status: 404 },
    );
  }
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.nombre.replace(/["\r\n]/g, "")}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
