import { NextResponse } from "next/server";
import {
  MAX_EXCEL_ROWS,
  buildExcelBuffer,
  sanitizeFilename,
} from "@/libs/export_excel";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const columns = Array.isArray(body.columns)
      ? body.columns.map((header) => String(header ?? "").trim()).filter(Boolean)
      : [];
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!columns.length) {
      return NextResponse.json(
        { success: false, error: "No hay columnas para exportar" },
        { status: 400 },
      );
    }
    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: "No hay filas para exportar" },
        { status: 400 },
      );
    }
    if (rows.length > MAX_EXCEL_ROWS) {
      return NextResponse.json(
        { success: false, error: `El reporte supera el máximo de ${MAX_EXCEL_ROWS} filas` },
        { status: 400 },
      );
    }

    const buffer = await buildExcelBuffer({
      sheet: body.sheet,
      columns,
      rows,
    });
    const filename = sanitizeFilename(body.filename);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("/api/excel:", error);
    return NextResponse.json(
      { success: false, error: error.message || "No se pudo generar el Excel" },
      { status: 500 },
    );
  }
}
