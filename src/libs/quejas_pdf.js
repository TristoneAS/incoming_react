import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { query } from "@/libs/incoming_db";
import { readPdfFromCandidates } from "@/libs/pdf_files";

export const PDF_CAMPO = "programa";
export const PDF_MODULO = "QUEJA";
const MAX_BYTES = 25 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF");

export function uploadsDir() {
  return (
    process.env.INCOMING_UPLOADS_DIR ||
    path.join(process.cwd(), "uploads", "quejas")
  );
}

export function pdfPath(programaId) {
  return path.join(uploadsDir(), `${Number(programaId)}.pdf`);
}

export function pdfUrl(programaId) {
  return `/api/quejas/programas/pdf?id=${Number(programaId)}`;
}

export function withPdfFlag(rows) {
  return rows.map((row) => ({
    ...row,
    tiene_pdf: Boolean(Number(row.tiene_pdf)),
    pdf_url: Number(row.tiene_pdf) ? pdfUrl(row.id) : null,
  }));
}

export async function readProgramaFields(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const fields = Object.fromEntries(
      [...form.entries()]
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value]),
    );
    const file = form.get("pdf") || form.get("fileUploader");
    return { fields, file: file instanceof File && file.size ? file : null };
  }
  return { fields: await request.json(), file: null };
}

export async function assertPdfFile(file) {
  if (!file) throw new Error("El archivo PDF es obligatorio");
  if (file.size > MAX_BYTES) {
    throw new Error("El PDF no puede superar 25 MB");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length < 5 || !buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    throw new Error("Solo se aceptan archivos PDF");
  }
  const mime = file.type || "application/pdf";
  if (mime && mime !== "application/pdf" && mime !== "application/x-pdf") {
    throw new Error("Solo se aceptan archivos PDF");
  }
  return buffer;
}

export async function saveProgramaPdf({
  programaId,
  file,
  usuario,
  required = false,
}) {
  if (!file) {
    if (required) throw new Error("El archivo PDF es obligatorio");
    return null;
  }
  const buffer = await assertPdfFile(file);
  await mkdir(uploadsDir(), { recursive: true });
  const ruta = pdfPath(programaId);
  await writeFile(ruta, buffer);
  const rutaRelativa = path.relative(process.cwd(), ruta);

  const existentes = await query(
    `SELECT id FROM adjuntos
     WHERE modulo = ? AND registro_id = ? AND campo = ? AND eliminado_en IS NULL`,
    [PDF_MODULO, programaId, PDF_CAMPO],
  );
  if (existentes.length) {
    await query(
      `UPDATE adjuntos
       SET nombre_original = ?, ruta = ?, mime = 'application/pdf',
           bytes = ?, creado_por = ?
       WHERE id = ?`,
      [file.name, rutaRelativa, buffer.length, usuario, existentes[0].id],
    );
  } else {
    await query(
      `INSERT INTO adjuntos
       (modulo, registro_id, campo, nombre_original, ruta, mime, bytes, creado_por)
       VALUES (?, ?, ?, ?, ?, 'application/pdf', ?, ?)`,
      [PDF_MODULO, programaId, PDF_CAMPO, file.name, rutaRelativa, buffer.length, usuario],
    );
  }
  return { ruta: rutaRelativa, bytes: buffer.length };
}

export async function readProgramaPdf(programaId) {
  const [adjunto] = await query(
    `SELECT * FROM adjuntos
     WHERE modulo = ? AND registro_id = ? AND campo = ? AND eliminado_en IS NULL
     ORDER BY id DESC LIMIT 1`,
    [PDF_MODULO, programaId, PDF_CAMPO],
  );
  const id = Number(programaId);
  return readPdfFromCandidates(
    [
      pdfPath(id),
      adjunto?.ruta,
      adjunto?.ruta ? path.join(uploadsDir(), path.basename(adjunto.ruta)) : null,
    ],
    adjunto?.nombre_original || `${id}.pdf`,
  );
}

export const PROGRAMA_SELECT = `SELECT p.*,
  EXISTS(
    SELECT 1 FROM adjuntos a
    WHERE a.modulo = '${PDF_MODULO}'
      AND a.registro_id = p.id
      AND a.campo = '${PDF_CAMPO}'
      AND a.eliminado_en IS NULL
  ) AS tiene_pdf
 FROM quejas_programas p`;
