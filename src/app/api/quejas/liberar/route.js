import { NextResponse } from "next/server";
import { query } from "@/libs/incoming_db";

const clean = (value) => String(value ?? "").trim() || null;

/** Campos del checklist que deben estar aprobados para liberar la inspección. */
const CAMPOS_CHECKLIST = [
  "embarque",
  "ocho_disciplinas",
  "acciones",
  "queja",
  "seguimiento_corporativo",
  "sqe",
];

function error(message, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const programaId = Number(body.programa_id);
    if (!Number.isInteger(programaId) || programaId < 1) {
      return error("Selecciona una inspección");
    }

    const [programa] = await query(
      "SELECT id, status FROM quejas_programas WHERE id = ? AND eliminado_en IS NULL",
      [programaId],
    );
    if (!programa) return error("La inspección no existe");
    if (programa.status === "LIBERADO") {
      return error("La inspección ya fue liberada");
    }

    const [checklist] = await query(
      "SELECT * FROM quejas_checklist WHERE programa_id = ? AND eliminado_en IS NULL",
      [programaId],
    );
    if (!checklist) return error("Captura el checklist antes de liberar");

    const pendientes = CAMPOS_CHECKLIST.filter(
      (campo) => checklist[campo] !== "APROBADO",
    );
    if (pendientes.length) {
      return error(
        "Todos los puntos del checklist deben estar aprobados para liberar",
      );
    }

    const usuario = clean(body.usuario);
    await query(
      `UPDATE quejas_programas
       SET status = 'LIBERADO', actualizado_por = ?
       WHERE id = ?`,
      [usuario, programaId],
    );
    await query(
      `UPDATE quejas_checklist
       SET status = 'LIBERADO',
           fecha_cierre = COALESCE(fecha_cierre, CURDATE()),
           actualizado_por = ?
       WHERE programa_id = ?`,
      [usuario, programaId],
    );
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario)
       VALUES ('QUEJAS_CHECKLIST', ?, 'LIBERAR', ?)`,
      [programaId, usuario],
    );

    return NextResponse.json({ success: true });
  } catch (cause) {
    console.error("POST /api/quejas/liberar:", cause);
    return error("No se pudo liberar la inspección", 500);
  }
}
