import { NextResponse } from "next/server";
import { query } from "@/libs/incoming_db";
import {
  PROGRAMA_SELECT,
  assertPdfFile,
  pdfUrl,
  readProgramaFields,
  saveProgramaPdf,
  withPdfFlag,
} from "@/libs/quejas_pdf";

function text(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function required(value, label) {
  const normalized = text(value);
  if (!normalized) throw new Error(`${label} es obligatorio`);
  return normalized;
}

function badRequest(message) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function isUserError(error) {
  return (
    error.message?.includes("obligatorio") ||
    error.message?.includes("PDF") ||
    error.message?.includes("25 MB")
  );
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const includeDeleted = params.get("eliminados") === "1";
    const sap = text(params.get("sap"));

    if (sap) {
      const rows = await query(
        `${PROGRAMA_SELECT}
         WHERE p.sap = ? AND p.eliminado_en IS NULL
         ORDER BY p.id DESC
         LIMIT 1`,
        [sap],
      );
      return NextResponse.json({ success: true, data: withPdfFlag(rows) });
    }

    const filters = [];
    if (!includeDeleted) filters.push("p.eliminado_en IS NULL");
    if (params.get("solo_activos") === "1") filters.push("p.status = 'ACTIVO'");

    const rows = await query(
      `${PROGRAMA_SELECT}
       ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
       ORDER BY p.id DESC`,
    );
    return NextResponse.json({ success: true, data: withPdfFlag(rows) });
  } catch (error) {
    console.error("GET /api/quejas/programas:", error);
    return NextResponse.json(
      { success: false, error: "No se pudieron consultar las inspecciones" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const { fields, file } = await readProgramaFields(request);
    await assertPdfFile(file);
    const values = [
      required(fields.sap, "Número SAP"),
      required(fields.proveedor, "Proveedor"),
      required(fields.cliente, "Cliente"),
      required(fields.plataforma, "Plataforma"),
      required(fields.descripcion, "Descripción"),
      text(fields.alerta_interna),
      text(fields.periodo_inspeccion),
      text(fields.comentario),
      text(fields.razon_queja),
      text(fields.numero_queja),
      text(fields.usuario),
    ];
    const result = await query(
      `INSERT INTO quejas_programas
       (sap, proveedor, cliente, plataforma, descripcion, alerta_interna,
        periodo_inspeccion, comentario, razon_queja, numero_queja, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values,
    );
    await saveProgramaPdf({
      programaId: result.insertId,
      file,
      usuario: text(fields.usuario),
      required: true,
    });
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario, detalle)
       VALUES ('QUEJAS_PROGRAMA', ?, 'CREAR', ?, ?)`,
      [
        result.insertId,
        text(fields.usuario),
        JSON.stringify({ ...fields, pdf: file?.name || null }),
      ],
    );
    return NextResponse.json(
      { success: true, id: result.insertId, pdf_url: pdfUrl(result.insertId) },
      { status: 201 },
    );
  } catch (error) {
    if (isUserError(error)) return badRequest(error.message);
    console.error("POST /api/quejas/programas:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo guardar la inspección" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    const { fields, file } = await readProgramaFields(request);
    const id = Number(fields.id);
    if (!Number.isInteger(id) || id < 1) return badRequest("Id inválido");

    const statusSql =
      fields.status === "LIBERADO" || fields.status === "ACTIVO"
        ? ", status = ?"
        : "";
    const bind = [
      required(fields.sap, "Número SAP"),
      required(fields.proveedor, "Proveedor"),
      required(fields.cliente, "Cliente"),
      required(fields.plataforma, "Plataforma"),
      required(fields.descripcion, "Descripción"),
      text(fields.alerta_interna),
      text(fields.periodo_inspeccion),
      text(fields.comentario),
      text(fields.razon_queja),
      text(fields.numero_queja),
      text(fields.usuario),
    ];
    if (statusSql) bind.push(fields.status);
    bind.push(id);

    const result = await query(
      `UPDATE quejas_programas SET
         sap = ?, proveedor = ?, cliente = ?, plataforma = ?, descripcion = ?,
         alerta_interna = ?, periodo_inspeccion = ?, comentario = ?,
         razon_queja = ?, numero_queja = ?, actualizado_por = ?
         ${statusSql}
       WHERE id = ? AND eliminado_en IS NULL`,
      bind,
    );
    if (!result.affectedRows) return badRequest("Registro no encontrado");
    await saveProgramaPdf({
      programaId: id,
      file,
      usuario: text(fields.usuario),
    });
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario, detalle)
       VALUES ('QUEJAS_PROGRAMA', ?, 'EDITAR', ?, ?)`,
      [
        id,
        text(fields.usuario),
        JSON.stringify({ ...fields, pdf: file?.name || null }),
      ],
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isUserError(error)) return badRequest(error.message);
    console.error("PUT /api/quejas/programas:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo actualizar la inspección" },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) return badRequest("Id inválido");
    const result = await query(
      `UPDATE quejas_programas
       SET eliminado_en = NOW(), eliminado_por = ?
       WHERE id = ? AND eliminado_en IS NULL`,
      [text(body.usuario), id],
    );
    if (!result.affectedRows) return badRequest("Registro no encontrado");
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario)
       VALUES ('QUEJAS_PROGRAMA', ?, 'ELIMINAR', ?)`,
      [id, text(body.usuario)],
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/quejas/programas:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo eliminar la inspección" },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) return badRequest("Id inválido");
    const result = await query(
      `UPDATE quejas_programas
       SET eliminado_en = NULL, eliminado_por = NULL, actualizado_por = ?
       WHERE id = ? AND eliminado_en IS NOT NULL`,
      [text(body.usuario), id],
    );
    if (!result.affectedRows) return badRequest("Registro no encontrado");
    await query(
      `INSERT INTO auditoria_eventos
       (modulo, registro_id, accion, usuario)
       VALUES ('QUEJAS_PROGRAMA', ?, 'RESTAURAR', ?)`,
      [id, text(body.usuario)],
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/quejas/programas:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo restaurar la inspección" },
      { status: 500 },
    );
  }
}
