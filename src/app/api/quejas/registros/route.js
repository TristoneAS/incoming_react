import { NextResponse } from "next/server";
import { query } from "@/libs/incoming_db";

const clean = (value) => String(value ?? "").trim() || null;
const number = (value) => Math.max(0, Number.parseInt(value, 10) || 0);
const invalidId = (id) => !Number.isInteger(id) || id < 1;

function error(message, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/** Error de captura: se devuelve tal cual al usuario. */
function invalido(message) {
  const cause = new Error(message);
  cause.esValidacion = true;
  return cause;
}

function values(body) {
  const programaId = Number(body.programa_id);
  if (invalidId(programaId)) throw invalido("Selecciona una inspección");
  if (!clean(body.fecha)) throw invalido("La fecha es obligatoria");
  const piezasTotales = number(body.piezas_totales);
  const piezasOk = number(body.piezas_ok);
  const piezasNok = number(body.piezas_nok);
  if (piezasTotales < 1) {
    throw invalido("Captura las piezas totales");
  }
  if (piezasOk + piezasNok !== piezasTotales) {
    throw invalido("Las piezas OK y NOK deben sumar el total inspeccionado");
  }
  return {
    programaId,
    piezasTotales,
    piezasOk,
    piezasNok,
    status: piezasNok > 0 ? "RECHAZADO" : "APROBADO",
  };
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const includeDeleted = params.get("eliminados") === "1";
    const programaId = Number(params.get("programa_id"));
    const filters = [];
    const bind = [];
    if (!includeDeleted) filters.push("r.eliminado_en IS NULL");
    if (!invalidId(programaId)) {
      filters.push("r.programa_id = ?");
      bind.push(programaId);
    }
    const rows = await query(
      `SELECT r.*, p.sap, p.proveedor, p.cliente, p.plataforma, p.descripcion
       FROM quejas_registros r
       INNER JOIN quejas_programas p ON p.id = r.programa_id
       ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
       ORDER BY r.id DESC`,
      bind,
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (cause) {
    console.error("GET /api/quejas/registros:", cause);
    return error("No se pudieron consultar los registros", 500);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = values(body);
    const result = await query(
      `INSERT INTO quejas_registros
       (programa_id, empleado, serial_lote, piezas_totales, piezas_ok,
        piezas_nok, fecha, comentario, status, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parsed.programaId,
        clean(body.empleado),
        clean(body.serial_lote),
        parsed.piezasTotales,
        parsed.piezasOk,
        parsed.piezasNok,
        body.fecha,
        clean(body.comentario),
        parsed.status,
        clean(body.usuario),
      ],
    );
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario, detalle)
       VALUES ('QUEJAS_REGISTRO', ?, 'CREAR', ?, ?)`,
      [result.insertId, clean(body.usuario), JSON.stringify(body)],
    );
    return NextResponse.json(
      { success: true, id: result.insertId },
      { status: 201 },
    );
  } catch (cause) {
    if (cause.esValidacion) return error(cause.message);
    console.error("POST /api/quejas/registros:", cause);
    return error("No se pudo guardar el registro", 500);
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (invalidId(id)) return error("Id inválido");
    const parsed = values(body);
    const result = await query(
      `UPDATE quejas_registros SET
         programa_id = ?, empleado = ?, serial_lote = ?, piezas_totales = ?,
         piezas_ok = ?, piezas_nok = ?, fecha = ?, comentario = ?,
         status = ?, actualizado_por = ?
       WHERE id = ? AND eliminado_en IS NULL`,
      [
        parsed.programaId,
        clean(body.empleado),
        clean(body.serial_lote),
        parsed.piezasTotales,
        parsed.piezasOk,
        parsed.piezasNok,
        body.fecha,
        clean(body.comentario),
        parsed.status,
        clean(body.usuario),
        id,
      ],
    );
    if (!result.affectedRows) return error("Registro no encontrado");
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario, detalle)
       VALUES ('QUEJAS_REGISTRO', ?, 'EDITAR', ?, ?)`,
      [id, clean(body.usuario), JSON.stringify(body)],
    );
    return NextResponse.json({ success: true });
  } catch (cause) {
    if (cause.esValidacion) return error(cause.message);
    console.error("PUT /api/quejas/registros:", cause);
    return error("No se pudo actualizar el registro", 500);
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (invalidId(id)) return error("Id inválido");
    const result = await query(
      `UPDATE quejas_registros
       SET eliminado_en = NOW(), eliminado_por = ?
       WHERE id = ? AND eliminado_en IS NULL`,
      [clean(body.usuario), id],
    );
    if (!result.affectedRows) return error("Registro no encontrado");
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario)
       VALUES ('QUEJAS_REGISTRO', ?, 'ELIMINAR', ?)`,
      [id, clean(body.usuario)],
    );
    return NextResponse.json({ success: true });
  } catch (cause) {
    console.error("DELETE /api/quejas/registros:", cause);
    return error("No se pudo eliminar el registro", 500);
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (invalidId(id)) return error("Id inválido");
    const result = await query(
      `UPDATE quejas_registros
       SET eliminado_en = NULL, eliminado_por = NULL, actualizado_por = ?
       WHERE id = ? AND eliminado_en IS NOT NULL`,
      [clean(body.usuario), id],
    );
    if (!result.affectedRows) return error("Registro no encontrado");
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario)
       VALUES ('QUEJAS_REGISTRO', ?, 'RESTAURAR', ?)`,
      [id, clean(body.usuario)],
    );
    return NextResponse.json({ success: true });
  } catch (cause) {
    console.error("PATCH /api/quejas/registros:", cause);
    return error("No se pudo restaurar el registro", 500);
  }
}
