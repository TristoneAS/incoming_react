import { NextResponse } from "next/server";
import { incomingDb } from "@/libs/incoming_db";
import {
  parseComponent,
  assertClasificacion,
  auditComponente,
  clean,
} from "@/libs/componentes_catalogo";
import {
  MAX_CARGA_BYTES,
  parseComponentesExcel,
} from "@/libs/componentes_excel";

export const runtime = "nodejs";

function responseError(message, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function databaseError(error) {
  if (error.isValidation) return responseError(error.message);
  console.error("/api/componentes/carga:", error);
  return responseError("No se pudo completar la carga masiva", 500);
}

function isXlsx(file, buffer) {
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  const zipMagic = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  return (
    zipMagic &&
    (name.endsWith(".xlsx") ||
      type.includes("spreadsheetml") ||
      type.includes("excel") ||
      !type)
  );
}

export async function POST(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return responseError("Adjunta el archivo Excel de la plantilla");
  }

  const form = await request.formData();
  const usuario = clean(form.get("usuario"));
  const file = form.get("archivo");
  if (!(file instanceof File) || !file.size) {
    return responseError("Adjunta el archivo Excel de la plantilla");
  }
  if (file.size > MAX_CARGA_BYTES) {
    return responseError("El archivo no puede superar 5 MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!isXlsx(file, buffer)) {
    return responseError("Usa la plantilla .xlsx descargada desde el catálogo");
  }

  let pending;
  try {
    pending = await parseComponentesExcel(buffer);
  } catch (error) {
    return responseError(error.message);
  }

  const connection = await incomingDb.getConnection();
  const created = [];
  const updated = [];
  const errors = [];
  try {
    await connection.beginTransaction();
    const saps = pending
      .map((row) => clean(row.values.sap)?.toUpperCase())
      .filter(Boolean);
    const existing = new Map();
    if (saps.length) {
      const [rows] = await connection.execute(
        `SELECT id, sap, eliminado_en
         FROM componentes
         WHERE sap IN (${saps.map(() => "?").join(",")})`,
        saps,
      );
      rows.forEach((row) => existing.set(row.sap, row));
    }

    const clasificaciones = new Set();
    for (const item of pending) {
      try {
        const values = parseComponent({ ...item.values, usuario });
        if (!clasificaciones.has(values.clasificacion)) {
          await assertClasificacion(connection, values.clasificacion);
          clasificaciones.add(values.clasificacion);
        }
        const current = existing.get(values.sap);
        if (current) {
          await connection.execute(
            `UPDATE componentes SET
               categoria = ?, estandar_pack = ?, clasificacion = ?,
               componente = ?, plataforma = ?, caracteristica_critica = ?,
               aql = ?, proveedor = ?, cliente = ?, actualizado_por = ?,
               eliminado_en = NULL, eliminado_por = NULL
             WHERE id = ?`,
            [
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
              current.id,
            ],
          );
          const action = current.eliminado_en ? "RESTAURAR" : "EDITAR";
          await auditComponente(connection, current.id, action, values.usuario, values);
          updated.push({ fila: item.fila, sap: values.sap, id: current.id });
        } else {
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
          await auditComponente(
            connection,
            result.insertId,
            "CREAR",
            values.usuario,
            values,
          );
          existing.set(values.sap, {
            id: result.insertId,
            sap: values.sap,
            eliminado_en: null,
          });
          created.push({ fila: item.fila, sap: values.sap, id: result.insertId });
        }
      } catch (error) {
        if (!error.isValidation) throw error;
        errors.push({
          fila: item.fila,
          sap: clean(item.values.sap)?.toUpperCase() || "",
          error: error.message,
        });
      }
    }

    if (!created.length && !updated.length) {
      await connection.rollback();
      return NextResponse.json(
        {
          success: false,
          error: "Ninguna fila se pudo cargar. Revisa los errores e inténtalo de nuevo.",
          created: 0,
          updated: 0,
          errors,
        },
        { status: 400 },
      );
    }

    await connection.commit();
    return NextResponse.json({
      success: true,
      created: created.length,
      updated: updated.length,
      errors,
    });
  } catch (error) {
    await connection.rollback();
    return databaseError(error);
  } finally {
    connection.release();
  }
}
