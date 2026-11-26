import { NextResponse } from "next/server";
import { query } from "@/libs/incoming_db";

const clean = (value) => String(value ?? "").trim() || null;
const invalidId = (id) => !Number.isInteger(id) || id < 1;

function error(message, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function programa(body) {
  const id = Number(body.programa_id);
  if (invalidId(id)) throw new Error("Selecciona una inspección");
  return id;
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const includeDeleted = params.get("eliminados") === "1";
    const rows = await query(
      `SELECT c.*, COALESCE(c.programa_id, p.id) AS programa_id,
              p.sap, p.proveedor, p.cliente, p.plataforma, p.descripcion,
              p.alerta_interna, p.periodo_inspeccion, p.razon_queja,
              p.numero_queja, p.comentario AS programa_comentario,
              p.status AS programa_status,
              EXISTS(
                SELECT 1 FROM adjuntos a
                WHERE a.modulo = 'QUEJA'
                  AND a.registro_id = p.id
                  AND a.campo = 'programa'
                  AND a.eliminado_en IS NULL
              ) AS tiene_pdf
       FROM quejas_programas p
       LEFT JOIN quejas_checklist c
         ON c.programa_id = p.id
         ${includeDeleted ? "" : "AND c.eliminado_en IS NULL"}
       WHERE p.eliminado_en IS NULL
       ORDER BY p.id DESC`,
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (cause) {
    console.error("GET /api/quejas/checklist:", cause);
    return error("No se pudo consultar el checklist", 500);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const programaId = programa(body);

    const [inspeccion] = await query(
      "SELECT status FROM quejas_programas WHERE id = ? AND eliminado_en IS NULL",
      [programaId],
    );
    if (!inspeccion) return error("La inspección no existe");
    if (inspeccion.status === "LIBERADO") {
      return error("La inspección ya fue liberada y no admite cambios");
    }

    const existing = await query(
      "SELECT id FROM quejas_checklist WHERE programa_id = ? LIMIT 1",
      [programaId],
    );
    const fields = [
      clean(body.embarque),
      clean(body.ocho_disciplinas),
      clean(body.acciones),
      clean(body.queja),
      clean(body.seguimiento_corporativo),
      clean(body.sqe),
      clean(body.comentario),
      clean(body.fecha),
      clean(body.fecha_cierre),
      "ACTIVO", // La liberación se hace desde /api/quejas/liberar.
      clean(body.usuario),
    ];

    let id;
    let action;
    if (existing.length) {
      id = existing[0].id;
      action = "EDITAR";
      await query(
        `UPDATE quejas_checklist SET
           embarque = ?, ocho_disciplinas = ?, acciones = ?, queja = ?,
           seguimiento_corporativo = ?, sqe = ?, comentario = ?, fecha = ?,
           fecha_cierre = ?, status = ?, usuario = ?, actualizado_por = ?,
           eliminado_en = NULL, eliminado_por = NULL
         WHERE id = ?`,
        [...fields, clean(body.usuario), id],
      );
    } else {
      action = "CREAR";
      const result = await query(
        `INSERT INTO quejas_checklist
         (programa_id, embarque, ocho_disciplinas, acciones, queja,
          seguimiento_corporativo, sqe, comentario, fecha, fecha_cierre,
          status, usuario)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [programaId, ...fields],
      );
      id = result.insertId;
    }

    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario, detalle)
       VALUES ('QUEJAS_CHECKLIST', ?, ?, ?, ?)`,
      [id, action, clean(body.usuario), JSON.stringify(body)],
    );
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (cause) {
    if (cause.message?.includes("Selecciona")) return error(cause.message);
    console.error("POST /api/quejas/checklist:", cause);
    return error("No se pudo guardar el checklist", 500);
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (invalidId(id)) return error("Id inválido");
    const result = await query(
      `UPDATE quejas_checklist
       SET eliminado_en = NOW(), eliminado_por = ?
       WHERE id = ? AND eliminado_en IS NULL`,
      [clean(body.usuario), id],
    );
    if (!result.affectedRows) return error("Registro no encontrado");
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario)
       VALUES ('QUEJAS_CHECKLIST', ?, 'ELIMINAR', ?)`,
      [id, clean(body.usuario)],
    );
    return NextResponse.json({ success: true });
  } catch (cause) {
    console.error("DELETE /api/quejas/checklist:", cause);
    return error("No se pudo eliminar el checklist", 500);
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (invalidId(id)) return error("Id inválido");
    const result = await query(
      `UPDATE quejas_checklist
       SET eliminado_en = NULL, eliminado_por = NULL, actualizado_por = ?
       WHERE id = ? AND eliminado_en IS NOT NULL`,
      [clean(body.usuario), id],
    );
    if (!result.affectedRows) return error("Registro no encontrado");
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario)
       VALUES ('QUEJAS_CHECKLIST', ?, 'RESTAURAR', ?)`,
      [id, clean(body.usuario)],
    );
    return NextResponse.json({ success: true });
  } catch (cause) {
    console.error("PATCH /api/quejas/checklist:", cause);
    return error("No se pudo restaurar el checklist", 500);
  }
}
