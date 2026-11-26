import { NextResponse } from "next/server";
import {
  buildComponentesPlantilla,
  PLANTILLA_NOMBRE,
} from "@/libs/componentes_excel";

export const runtime = "nodejs";

export async function GET() {
  try {
    const buffer = await buildComponentesPlantilla();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${PLANTILLA_NOMBRE}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("/api/componentes/plantilla:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo generar la plantilla" },
      { status: 500 },
    );
  }
}
