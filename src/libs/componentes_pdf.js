import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readPdfFromCandidates } from "@/libs/pdf_files";

export const REVISION_PDF_FIELDS = ["sin_rebabas", "dimensional"];
const MAX_BYTES = 25 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF");

export function revisionesUploadsDir() {
  return (
    process.env.INCOMING_UPLOADS_DIR ||
    path.join(process.cwd(), "uploads", "revisiones")
  );
}

export async function readRevisionRequest(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return { fields: await request.json(), files: {} };
  }
  const form = await request.formData();
  const fields = Object.fromEntries(
    [...form.entries()].filter(([, value]) => typeof value === "string"),
  );
  const files = Object.fromEntries(
    REVISION_PDF_FIELDS.map((field) => {
      const file = form.get(`pdf_${field}`) || form.get(field);
      return [field, file instanceof File && file.size ? file : null];
    }),
  );
  return { fields, files };
}

export async function validatePdf(file) {
  if (!file) return null;
  if (file.size > MAX_BYTES) throw new Error("El PDF no puede superar 25 MB");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length < 5 || !buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    throw new Error("Solo se aceptan archivos PDF válidos");
  }
  const mime = file.type || "application/pdf";
  if (!["application/pdf", "application/x-pdf"].includes(mime)) {
    throw new Error("Solo se aceptan archivos PDF");
  }
  return buffer;
}

export async function saveRevisionPdfs({
  connection,
  revisionId,
  files,
  usuario,
}) {
  const prepared = [];
  for (const field of REVISION_PDF_FIELDS) {
    const file = files[field];
    if (file) prepared.push({ field, file, buffer: await validatePdf(file) });
  }
  if (!prepared.length) return;

  await mkdir(revisionesUploadsDir(), { recursive: true });
  for (const item of prepared) {
    const ruta = path.join(
      revisionesUploadsDir(),
      `${Number(revisionId)}-${item.field}.pdf`,
    );
    await writeFile(ruta, item.buffer);
    const rutaRelativa = path.relative(process.cwd(), ruta);
    const [existing] = await connection.execute(
      `SELECT id FROM adjuntos
       WHERE modulo = 'REVISION' AND registro_id = ? AND campo = ?
         AND eliminado_en IS NULL
       ORDER BY id DESC LIMIT 1`,
      [revisionId, item.field],
    );
    if (existing.length) {
      await connection.execute(
        `UPDATE adjuntos
         SET nombre_original = ?, ruta = ?, mime = 'application/pdf',
             bytes = ?, creado_por = ?, eliminado_en = NULL
         WHERE id = ?`,
        [item.file.name, rutaRelativa, item.buffer.length, usuario, existing[0].id],
      );
    } else {
      await connection.execute(
        `INSERT INTO adjuntos
         (modulo, registro_id, campo, nombre_original, ruta, mime, bytes, creado_por)
         VALUES ('REVISION', ?, ?, ?, ?, 'application/pdf', ?, ?)`,
        [
          revisionId,
          item.field,
          item.file.name,
          rutaRelativa,
          item.buffer.length,
          usuario,
        ],
      );
    }
  }
}

export async function readRevisionPdf(revisionId, campo, query) {
  if (!REVISION_PDF_FIELDS.includes(campo)) return null;
  const rows = await query(
    `SELECT nombre_original, ruta FROM adjuntos
     WHERE modulo = 'REVISION' AND registro_id = ? AND campo = ?
       AND eliminado_en IS NULL
     ORDER BY id DESC LIMIT 1`,
    [revisionId, campo],
  );
  const esperado = path.join(
    revisionesUploadsDir(),
    `${Number(revisionId)}-${campo}.pdf`,
  );
  return readPdfFromCandidates(
    [
      esperado,
      rows[0]?.ruta,
      rows[0]?.ruta
        ? path.join(revisionesUploadsDir(), path.basename(rows[0].ruta))
        : null,
    ],
    rows[0]?.nombre_original || `${revisionId}-${campo}.pdf`,
  );
}
