import { NextResponse } from "next/server";
import { query } from "@/libs/incoming_db";

export async function GET() {
  try {
    const rows = await query("SELECT DATABASE() AS db, NOW() AS now");
    return NextResponse.json({
      ok: true,
      database: rows?.[0]?.db ?? null,
      now: rows?.[0]?.now ?? null,
    });
  } catch (error) {
    console.error("Error en /api/health:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          "No se pudo conectar a MySQL. Revisa MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD y MYSQL_DATABASE en .env.local",
      },
      { status: 500 },
    );
  }
}
