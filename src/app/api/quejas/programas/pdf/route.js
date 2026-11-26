import { NextResponse } from "next/server";
import { readProgramaPdf } from "@/libs/quejas_pdf";

export const runtime = "nodejs";

export async function GET(request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json(
      { success: false, error: "Id inválido" },
      { status: 400 },
    );
  }

  const file = await readProgramaPdf(id);
  if (!file) {
    return NextResponse.json(
      { success: false, error: "No hay PDF para esta inspección" },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.nombre.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
