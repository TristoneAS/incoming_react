import { NextResponse } from "next/server";
import { incomingDb, query } from "@/libs/incoming_db";
import {
  readRevisionRequest,
  saveRevisionPdfs,
} from "@/libs/componentes_pdf";
import { syncTipoInspeccion } from "@/libs/tipo_inspeccion";
import { resolverMuestra } from "@/libs/aql_muestra";

const OK_NOK = new Set(["OK", "NOK"]);
const OK_NOK_NA = new Set(["OK", "NOK", "NA"]);
const SI_NO = new Set(["SI", "NO"]);
const CHECKS = [
  "sin_golpes",
  "libre_quebraduras",
  "sin_rebabas",
  "sin_rayaduras",
  "legible",
  "sin_falta_subcomponentes",
];
const clean = (value) => String(value ?? "").trim() || null;
const invalidId = (id) => !Number.isInteger(id) || id < 1;

function validation(message) {
  const error = new Error(message);
  error.isValidation = true;
  return error;
}

function bad(message, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function bool(value) {
  return ["1", "true", "si", "sí"].includes(String(value ?? "").toLowerCase())
    ? 1
    : 0;
}

function parse(fields) {
  const componenteId = Number(fields.componente_id);
  if (invalidId(componenteId)) throw validation("Selecciona un componente");
  if (!clean(fields.fecha)) throw validation("La fecha es obligatoria");
  const checks = Object.fromEntries(
    CHECKS.map((field) => {
      const value = clean(fields[field])?.toUpperCase();
      if (!OK_NOK.has(value)) throw validation(`El campo ${field} debe ser OK o NOK`);
      return [field, value];
    }),
  );
  const forma = clean(fields.forma_adecuada)?.toUpperCase() || "NA";
  const dimensional = clean(fields.dimensional)?.toUpperCase() || "NO";
  if (!OK_NOK_NA.has(forma)) {
    throw validation("Forma adecuada debe ser OK, NOK o NA");
  }
  if (!SI_NO.has(dimensional)) throw validation("Dimensional debe ser SI o NO");
  const resultado =
    Object.values(checks).includes("NOK") || forma === "NOK"
      ? "NO_CONFORME"
      : "CONFORME";
  return {
    componenteId,
    fecha: fields.fecha,
    checks,
    forma,
    dimensional,
    resultado,
    serial: clean(fields.serial_lote),
    tamanoLote: fields.tamano_lote,
    comentario: clean(fields.comentario),
    notificado: bool(fields.notificado_sqe),
    usuario: clean(fields.usuario),
  };
}

async function componentData(connection, id) {
  const [rows] = await connection.execute(
    `SELECT id, sap, proveedor, cliente, plataforma, caracteristica_critica
     FROM componentes WHERE id = ? AND eliminado_en IS NULL LIMIT 1`,
    [id],
  );
  if (!rows.length) throw validation("El componente seleccionado no existe o está eliminado");
  return rows[0];
}

async function revisionWeek(connection, id) {
  const [rows] = await connection.execute(
    "SELECT componente_id, anio, semana FROM componente_revisiones WHERE id = ?",
    [id],
  );
  return rows[0] || null;
}

async function syncWeek(connection, componenteId, anio, semana) {
  if (!componenteId || !anio || !semana) return;
  const [rows] = await connection.execute(
    `SELECT id, resultado FROM componente_revisiones
     WHERE componente_id = ? AND anio = ? AND semana = ?
       AND eliminado_en IS NULL
     ORDER BY (resultado = 'NO_CONFORME') DESC, id DESC LIMIT 1`,
    [componenteId, anio, semana],
  );
  if (rows.length) {
    await connection.execute(
      `INSERT INTO componente_semanas
       (componente_id, anio, semana, estado, revision_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE estado = VALUES(estado), revision_id = VALUES(revision_id)`,
      [componenteId, anio, semana, rows[0].resultado, rows[0].id],
    );
  } else {
    await connection.execute(
      `INSERT INTO componente_semanas
       (componente_id, anio, semana, estado, revision_id)
       VALUES (?, ?, ?, 'PROGRAMADA', NULL)
       ON DUPLICATE KEY UPDATE estado = 'PROGRAMADA', revision_id = NULL`,
      [componenteId, anio, semana],
    );
  }
}

async function audit(connection, id, action, usuario, detail = null) {
  await connection.execute(
    `INSERT INTO auditoria_eventos
     (modulo, registro_id, accion, usuario, detalle)
     VALUES ('REVISION', ?, ?, ?, ?)`,
    [id, action, usuario, detail ? JSON.stringify(detail) : null],
  );
}

function handleError(error) {
  if (
    error.isValidation ||
    error.message?.includes("PDF") ||
    error.message?.includes("25 MB")
  ) {
    return bad(error.message);
  }
  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    return bad("El componente o la semana relacionada ya no existe");
  }
  console.error("/api/componentes/revisiones:", error);
  return bad("No se pudo completar la operación de revisiones", 500);
}

const SELECT = `SELECT r.*, c.componente, c.categoria, c.clasificacion,
  EXISTS(
    SELECT 1 FROM adjuntos a WHERE a.modulo = 'REVISION'
      AND a.registro_id = r.id AND a.campo = 'sin_rebabas'
      AND a.eliminado_en IS NULL
  ) AS pdf_sin_rebabas,
  EXISTS(
    SELECT 1 FROM adjuntos a WHERE a.modulo = 'REVISION'
      AND a.registro_id = r.id AND a.campo = 'dimensional'
      AND a.eliminado_en IS NULL
  ) AS pdf_dimensional
 FROM componente_revisiones r
 LEFT JOIN componentes c ON c.id = r.componente_id`;

export async function GET(request) {
  try {
    const params = request.nextUrl.searchParams;
    const filters = [];
    const bind = [];
    if (params.get("eliminados") !== "1") filters.push("r.eliminado_en IS NULL");
    const componenteId = Number(params.get("componente_id"));
    const anio = Number(params.get("anio"));
    if (!invalidId(componenteId)) {
      filters.push("r.componente_id = ?");
      bind.push(componenteId);
    }
    if (Number.isInteger(anio) && anio > 2000) {
      filters.push("r.anio = ?");
      bind.push(anio);
    }
    const rows = await query(
      `${SELECT}
       ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
       ORDER BY r.fecha DESC, r.id DESC`,
      bind,
    );
    const weekFilters = [];
    const weekBind = [];
    if (!invalidId(componenteId)) {
      weekFilters.push("s.componente_id = ?");
      weekBind.push(componenteId);
    }
    if (Number.isInteger(anio) && anio > 2000) {
      weekFilters.push("s.anio = ?");
      weekBind.push(anio);
    }
    const semanas = await query(
      `SELECT s.*, c.sap, c.componente
       FROM componente_semanas s
       INNER JOIN componentes c ON c.id = s.componente_id
       ${weekFilters.length ? `WHERE ${weekFilters.join(" AND ")}` : ""}
       ORDER BY s.anio DESC, s.semana`,
      weekBind,
    );
    return NextResponse.json({ success: true, data: rows, semanas });
  } catch (error) {
    return handleError(error);
  }
}

async function createOrUpdate(request, updating) {
  const connection = await incomingDb.getConnection();
  try {
    const { fields, files } = await readRevisionRequest(request);
    const id = Number(fields.id);
    if (updating && invalidId(id)) throw validation("Id inválido");
    const values = parse(fields);
    await connection.beginTransaction();
    const component = await componentData(connection, values.componenteId);
    const muestreo = await resolverMuestra(
      connection,
      values.componenteId,
      values.tamanoLote,
    );
    const previous = updating ? await revisionWeek(connection, id) : null;
    if (updating && !previous) throw validation("Revisión no encontrada");
    const bind = [
      values.componenteId,
      component.proveedor,
      component.sap,
      component.cliente,
      component.plataforma,
      component.caracteristica_critica,
      values.fecha,
      values.serial,
      muestreo.tamano_lote,
      muestreo.letra,
      muestreo.muestra,
      ...CHECKS.map((field) => values.checks[field]),
      values.forma,
      values.dimensional,
      values.comentario,
      values.resultado,
      values.notificado,
      values.usuario,
    ];
    let revisionId = id;
    if (updating) {
      const [result] = await connection.execute(
        `UPDATE componente_revisiones SET
           componente_id = ?, proveedor = ?, sap = ?, cliente = ?, plataforma = ?,
           caracteristica_critica = ?, fecha = ?, serial_lote = ?,
           tamano_lote = ?, letra_muestra = ?, muestra = ?,
           sin_golpes = ?, libre_quebraduras = ?, sin_rebabas = ?,
           sin_rayaduras = ?, legible = ?, sin_falta_subcomponentes = ?,
           forma_adecuada = ?, dimensional = ?, comentario = ?, resultado = ?,
           notificado_sqe = ?, actualizado_por = ?
         WHERE id = ? AND eliminado_en IS NULL`,
        [...bind, id],
      );
      if (!result.affectedRows) throw validation("Revisión no encontrada");
    } else {
      const [result] = await connection.execute(
        `INSERT INTO componente_revisiones
         (componente_id, proveedor, sap, cliente, plataforma,
          caracteristica_critica, fecha, serial_lote, tamano_lote,
          letra_muestra, muestra, sin_golpes, libre_quebraduras, sin_rebabas,
          sin_rayaduras, legible, sin_falta_subcomponentes, forma_adecuada,
          dimensional, comentario, resultado, notificado_sqe, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        bind,
      );
      revisionId = result.insertId;
    }
    await saveRevisionPdfs({
      connection,
      revisionId,
      files,
      usuario: values.usuario,
    });
    const current = await revisionWeek(connection, revisionId);
    if (
      previous &&
      (previous.componente_id !== current.componente_id ||
        previous.anio !== current.anio ||
        previous.semana !== current.semana)
    ) {
      await syncWeek(
        connection,
        previous.componente_id,
        previous.anio,
        previous.semana,
      );
    }
    await syncWeek(connection, current.componente_id, current.anio, current.semana);
    if (previous && previous.componente_id !== current.componente_id) {
      await syncTipoInspeccion(connection, previous.componente_id, values.usuario);
    }
    const tipoInspeccion = await syncTipoInspeccion(
      connection,
      current.componente_id,
      values.usuario,
    );
    await audit(
      connection,
      revisionId,
      updating ? "EDITAR" : "CREAR",
      values.usuario,
      { ...values, files: Object.keys(files).filter((key) => files[key]) },
    );
    await connection.commit();
    return NextResponse.json(
      {
        success: true,
        id: revisionId,
        resultado: values.resultado,
        tipo_inspeccion: tipoInspeccion,
        letra: muestreo.letra,
        muestra: muestreo.muestra,
      },
      { status: updating ? 200 : 201 },
    );
  } catch (error) {
    await connection.rollback();
    return handleError(error);
  } finally {
    connection.release();
  }
}

export async function POST(request) {
  return createOrUpdate(request, false);
}

export async function PUT(request) {
  return createOrUpdate(request, true);
}

async function toggleDeleted(request, restore) {
  const connection = await incomingDb.getConnection();
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (invalidId(id)) throw validation("Id inválido");
    const usuario = clean(body.usuario);
    await connection.beginTransaction();
    const previous = await revisionWeek(connection, id);
    if (!previous) throw validation("Revisión no encontrada");
    const [result] = await connection.execute(
      restore
        ? `UPDATE componente_revisiones
           SET eliminado_en = NULL, eliminado_por = NULL, actualizado_por = ?
           WHERE id = ? AND eliminado_en IS NOT NULL`
        : `UPDATE componente_revisiones
           SET eliminado_en = NOW(), eliminado_por = ?
           WHERE id = ? AND eliminado_en IS NULL`,
      [usuario, id],
    );
    if (!result.affectedRows) throw validation("Revisión no encontrada");
    await syncWeek(
      connection,
      previous.componente_id,
      previous.anio,
      previous.semana,
    );
    await audit(connection, id, restore ? "RESTAURAR" : "ELIMINAR", usuario);
    const tipoInspeccion = await syncTipoInspeccion(
      connection,
      previous.componente_id,
      usuario,
    );
    await connection.commit();
    return NextResponse.json({ success: true, tipo_inspeccion: tipoInspeccion });
  } catch (error) {
    await connection.rollback();
    return handleError(error);
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
