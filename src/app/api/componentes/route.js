import { NextResponse } from "next/server";
import { incomingDb, query } from "@/libs/incoming_db";
import {
  parseComponent,
  assertClasificacion,
  auditComponente,
  validation,
  clean,
} from "@/libs/componentes_catalogo";

const invalidId = (id) => !Number.isInteger(id) || id < 1;

function responseError(message, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function databaseError(error) {
  if (error.isValidation) return responseError(error.message);
  if (error.code === "ER_DUP_ENTRY") {
    return responseError("Ya existe un componente con ese SAP");
  }
  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    return responseError(
      "La clasificación no existe en clasificacion_reglas. Carga primero ese catálogo.",
    );
  }
  console.error("/api/componentes:", error);
  return responseError("No se pudo completar la operación de componentes", 500);
}

export async function GET(request) {
  try {
    const params = request.nextUrl.searchParams;
    const filters = [];
    const bind = [];
    if (params.get("eliminados") !== "1") filters.push("c.eliminado_en IS NULL");
    if (clean(params.get("sap"))) {
      filters.push("c.sap = ?");
      bind.push(clean(params.get("sap")).toUpperCase());
    }
    const rows = await query(
      `SELECT c.*, r.frecuencia, r.metodo, r.regla
       FROM componentes c
       LEFT JOIN clasificacion_reglas r ON r.clasificacion = c.clasificacion
       ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
       ORDER BY c.id DESC`,
      bind,
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request) {
  const connection = await incomingDb.getConnection();
  try {
    const body = await request.json();
    const values = parseComponent(body);
    await connection.beginTransaction();
    await assertClasificacion(connection, values.clasificacion);
    const [result] = await connection.execute(
      `INSERT INTO componentes
       (sap, categoria, estandar_pack, clasificacion, componente, plataforma,
        caracteristica_critica, aql, tipo_inspeccion, proveedor, cliente, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        values.sap,
        values.categoria,
        values.estandarPack,
        values.clasificacion,
        values.componente,
        values.plataforma,
        values.critica,
        values.aql,
        "ESTRICTA",
        values.proveedor,
        values.cliente,
        values.usuario,
      ],
    );
    await auditComponente(connection, result.insertId, "CREAR", values.usuario, values);
    await connection.commit();
    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    return databaseError(error);
  } finally {
    connection.release();
  }
}

export async function PUT(request) {
  const connection = await incomingDb.getConnection();
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (invalidId(id)) throw validation("Id inválido");
    const values = parseComponent(body);
    await connection.beginTransaction();
    await assertClasificacion(connection, values.clasificacion);
    const [result] = await connection.execute(
      `UPDATE componentes SET
         sap = ?, categoria = ?, estandar_pack = ?, clasificacion = ?,
         componente = ?, plataforma = ?, caracteristica_critica = ?,
         aql = ?, proveedor = ?, cliente = ?, actualizado_por = ?
       WHERE id = ? AND eliminado_en IS NULL`,
      [
        values.sap,
        values.categoria,
        values.estandarPack,
        values.clasificacion,
        values.componente,
        values.plataforma,
        values.critica,
        values.aql,
        values.proveedor,
        values.cliente,
        values.usuario,
        id,
      ],
    );
    if (!result.affectedRows) throw validation("Componente no encontrado");
    await auditComponente(connection, id, "EDITAR", values.usuario, values);
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    await connection.rollback();
    return databaseError(error);
  } finally {
    connection.release();
  }
}

async function toggleDeleted(request, restore) {
  const connection = await incomingDb.getConnection();
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (invalidId(id)) throw validation("Id inválido");
    const usuario = clean(body.usuario);
    await connection.beginTransaction();
    const [result] = await connection.execute(
      restore
        ? `UPDATE componentes
           SET eliminado_en = NULL, eliminado_por = NULL, actualizado_por = ?
           WHERE id = ? AND eliminado_en IS NOT NULL`
        : `UPDATE componentes
           SET eliminado_en = NOW(), eliminado_por = ?
           WHERE id = ? AND eliminado_en IS NULL`,
      [usuario, id],
    );
    if (!result.affectedRows) throw validation("Componente no encontrado");
    await auditComponente(connection, id, restore ? "RESTAURAR" : "ELIMINAR", usuario);
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    await connection.rollback();
    return databaseError(error);
  } finally {
    connection.release();
  }
}

export async function DELETE(request) {
  return toggleDeleted(request, false);
}

export async function PATCH(request) {
  return toggleDeleted(request, true);
}
