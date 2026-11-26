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
  if (!clean(body.proveedor)) throw invalido("El proveedor es obligatorio");
  if (!clean(body.sap)) throw invalido("El SAP es obligatorio");
  if (!clean(body.material)) throw invalido("El material es obligatorio");
  if (!clean(body.fecha)) throw invalido("La fecha es obligatoria");
  const piezasTotales = number(body.piezas_totales);
  const piezasOk = number(body.piezas_ok);
  const piezasNok = number(body.piezas_nok);
  const estandarPack = number(body.estandar_pack);
  if (piezasTotales < 1) {
    throw invalido("Captura las piezas totales");
  }
  if (piezasOk + piezasNok !== piezasTotales) {
    throw invalido("Las piezas OK y NOK deben sumar el total inspeccionado");
  }
  if (estandarPack < 1) {
    throw invalido("Captura el estándar pack (piezas por caja)");
  }
  return { piezasTotales, piezasOk, piezasNok, estandarPack };
}

const SELECT = `SELECT s.*,
  CASE WHEN s.piezas_nok > 0 THEN 'RECHAZADO' ELSE 'APROBADO' END AS estatus,
  CASE WHEN s.estandar_pack > 0
    THEN ROUND(s.piezas_totales / CAST(s.estandar_pack AS DECIMAL(12,4)), 2)
    ELSE NULL END AS cajas_totales,
  CASE WHEN s.estandar_pack > 0
    THEN ROUND(s.piezas_ok / CAST(s.estandar_pack AS DECIMAL(12,4)), 2)
    ELSE NULL END AS cajas_conforme
  FROM sorteos_especiales s`;

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const includeDeleted = params.get("eliminados") === "1";
    const filters = [];
    const bind = [];
    if (!includeDeleted) filters.push("s.eliminado_en IS NULL");
    const rows = await query(
      `${SELECT}
       ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
       ORDER BY s.id DESC`,
      bind,
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (cause) {
    console.error("GET /api/sorteos:", cause);
    return error("No se pudieron consultar los sorteos", 500);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = values(body);
    const result = await query(
      `INSERT INTO sorteos_especiales
       (proveedor, sap, material, fecha, serial_lote, estandar_pack,
        piezas_totales, piezas_ok, piezas_nok, comentario, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clean(body.proveedor),
        clean(body.sap),
        clean(body.material),
        body.fecha,
        clean(body.serial_lote),
        parsed.estandarPack,
        parsed.piezasTotales,
        parsed.piezasOk,
        parsed.piezasNok,
        clean(body.comentario),
        clean(body.usuario),
      ],
    );
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario, detalle)
       VALUES ('SORTEO', ?, 'CREAR', ?, ?)`,
      [result.insertId, clean(body.usuario), JSON.stringify(body)],
    );
    return NextResponse.json(
      { success: true, id: result.insertId },
      { status: 201 },
    );
  } catch (cause) {
    if (cause.esValidacion) return error(cause.message);
    console.error("POST /api/sorteos:", cause);
    return error("No se pudo guardar el sorteo", 500);
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (invalidId(id)) return error("Id inválido");
    const parsed = values(body);
    const result = await query(
      `UPDATE sorteos_especiales SET
         proveedor = ?, sap = ?, material = ?, fecha = ?, serial_lote = ?,
         estandar_pack = ?, piezas_totales = ?, piezas_ok = ?, piezas_nok = ?,
         comentario = ?, actualizado_por = ?
       WHERE id = ? AND eliminado_en IS NULL`,
      [
        clean(body.proveedor),
        clean(body.sap),
        clean(body.material),
        body.fecha,
        clean(body.serial_lote),
        parsed.estandarPack,
        parsed.piezasTotales,
        parsed.piezasOk,
        parsed.piezasNok,
        clean(body.comentario),
        clean(body.usuario),
        id,
      ],
    );
    if (!result.affectedRows) return error("Registro no encontrado");
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario, detalle)
       VALUES ('SORTEO', ?, 'EDITAR', ?, ?)`,
      [id, clean(body.usuario), JSON.stringify(body)],
    );
    return NextResponse.json({ success: true });
  } catch (cause) {
    if (cause.esValidacion) return error(cause.message);
    console.error("PUT /api/sorteos:", cause);
    return error("No se pudo actualizar el sorteo", 500);
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (invalidId(id)) return error("Id inválido");
    const result = await query(
      `UPDATE sorteos_especiales
       SET eliminado_en = NOW(), eliminado_por = ?
       WHERE id = ? AND eliminado_en IS NULL`,
      [clean(body.usuario), id],
    );
    if (!result.affectedRows) return error("Registro no encontrado");
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario)
       VALUES ('SORTEO', ?, 'ELIMINAR', ?)`,
      [id, clean(body.usuario)],
    );
    return NextResponse.json({ success: true });
  } catch (cause) {
    console.error("DELETE /api/sorteos:", cause);
    return error("No se pudo eliminar el sorteo", 500);
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (invalidId(id)) return error("Id inválido");
    const result = await query(
      `UPDATE sorteos_especiales
       SET eliminado_en = NULL, eliminado_por = NULL, actualizado_por = ?
       WHERE id = ? AND eliminado_en IS NOT NULL`,
      [clean(body.usuario), id],
    );
    if (!result.affectedRows) return error("Registro no encontrado");
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario)
       VALUES ('SORTEO', ?, 'RESTAURAR', ?)`,
      [id, clean(body.usuario)],
    );
    return NextResponse.json({ success: true });
  } catch (cause) {
    console.error("PATCH /api/sorteos:", cause);
    return error("No se pudo restaurar el sorteo", 500);
  }
}
