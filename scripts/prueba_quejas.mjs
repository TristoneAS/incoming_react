/**
 * Prueba de humo del módulo Quejas contra el servidor de desarrollo.
 * Crea datos de prueba, valida el flujo completo y los elimina al final.
 * Uso: node scripts/prueba_quejas.mjs
 */
import mysql from "mysql2/promise";
import { unlink } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const USUARIO = "PRUEBA_AUTOMATICA";
const resultados = [];

async function llamar(ruta, options = {}) {
  const response = await fetch(`${BASE}${ruta}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return { status: response.status, body: await response.json() };
}

function revisar(nombre, condicion, detalle = "") {
  resultados.push({ nombre, ok: Boolean(condicion), detalle });
}

const sinPdf = await llamar("/api/quejas/programas", {
  method: "POST",
  body: JSON.stringify({
    sap: "ZZTEST999",
    proveedor: "PROVEEDOR PRUEBA",
    cliente: "CLIENTE PRUEBA",
    plataforma: "PLATAFORMA PRUEBA",
    descripcion: "MANGUERA DE PRUEBA",
    usuario: USUARIO,
  }),
});
revisar("PDF obligatorio", sinPdf.status === 400, sinPdf.body.error);

const form = new FormData();
form.append("sap", "ZZTEST999");
form.append("proveedor", "PROVEEDOR PRUEBA");
form.append("cliente", "CLIENTE PRUEBA");
form.append("plataforma", "PLATAFORMA PRUEBA");
form.append("descripcion", "MANGUERA DE PRUEBA");
form.append("alerta_interna", "ALERTA 1");
form.append("periodo_inspeccion", "SEMANAL");
form.append("razon_queja", "FUGA");
form.append("numero_queja", "Q-999");
form.append("usuario", USUARIO);
form.append(
  "pdf",
  new Blob(["%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"], {
    type: "application/pdf",
  }),
  "prueba.pdf",
);
const programaRes = await fetch(`${BASE}/api/quejas/programas`, {
  method: "POST",
  body: form,
});
const programa = {
  status: programaRes.status,
  body: await programaRes.json(),
};
revisar("Crear inspección", programa.status === 201, JSON.stringify(programa.body));
const programaId = programa.body.id;

const pdfRes = await fetch(`${BASE}/api/quejas/programas/pdf?id=${programaId}`);
revisar(
  "Servir PDF",
  pdfRes.status === 200 && pdfRes.headers.get("content-type")?.includes("pdf"),
);

const autocompletar = await llamar("/api/quejas/programas?sap=ZZTEST999");
revisar(
  "Autocompletar por SAP",
  autocompletar.body.data?.[0]?.proveedor === "PROVEEDOR PRUEBA",
);

const soloActivos = await llamar("/api/quejas/programas?solo_activos=1");
revisar(
  "Listar solo activos",
  soloActivos.body.data?.some((row) => row.id === programaId),
);

const sumaMala = await llamar("/api/quejas/registros", {
  method: "POST",
  body: JSON.stringify({
    programa_id: programaId,
    fecha: "2026-09-11",
    piezas_totales: 10,
    piezas_ok: 5,
    piezas_nok: 2,
    usuario: USUARIO,
  }),
});
revisar("Rechazar suma incorrecta", sumaMala.status === 400, sumaMala.body.error);

const registro = await llamar("/api/quejas/registros", {
  method: "POST",
  body: JSON.stringify({
    programa_id: programaId,
    fecha: "2026-09-11",
    serial_lote: "LOTE-1",
    piezas_totales: 10,
    piezas_ok: 8,
    piezas_nok: 2,
    empleado: USUARIO,
    usuario: USUARIO,
  }),
});
revisar("Crear registro", registro.status === 201);

const historial = await llamar(`/api/quejas/registros?programa_id=${programaId}`);
revisar(
  "Historial y estatus RECHAZADO",
  historial.body.data?.[0]?.status === "RECHAZADO",
);

const parcial = await llamar("/api/quejas/checklist", {
  method: "POST",
  body: JSON.stringify({
    programa_id: programaId,
    embarque: "APROBADO",
    ocho_disciplinas: "RECHAZADO",
    acciones: "APROBADO",
    queja: "APROBADO",
    seguimiento_corporativo: "APROBADO",
    sqe: "APROBADO",
    fecha: "2026-09-11",
    usuario: USUARIO,
  }),
});
revisar("Guardar checklist parcial", parcial.status === 201);

const liberarMal = await llamar("/api/quejas/liberar", {
  method: "POST",
  body: JSON.stringify({ programa_id: programaId, usuario: USUARIO }),
});
revisar(
  "Bloquear liberación incompleta",
  liberarMal.status === 400,
  liberarMal.body.error,
);

await llamar("/api/quejas/checklist", {
  method: "POST",
  body: JSON.stringify({
    programa_id: programaId,
    embarque: "APROBADO",
    ocho_disciplinas: "APROBADO",
    acciones: "APROBADO",
    queja: "APROBADO",
    seguimiento_corporativo: "APROBADO",
    sqe: "APROBADO",
    fecha: "2026-09-11",
    usuario: USUARIO,
  }),
});

const liberar = await llamar("/api/quejas/liberar", {
  method: "POST",
  body: JSON.stringify({ programa_id: programaId, usuario: USUARIO }),
});
revisar("Liberar inspección", liberar.status === 200, JSON.stringify(liberar.body));

const checklist = await llamar("/api/quejas/checklist");
const liberado = checklist.body.data?.find((row) => row.programa_id === programaId);
revisar("Programa marcado LIBERADO", liberado?.programa_status === "LIBERADO");
revisar("Fecha de cierre automática", Boolean(liberado?.fecha_cierre));

const reEditar = await llamar("/api/quejas/checklist", {
  method: "POST",
  body: JSON.stringify({
    programa_id: programaId,
    embarque: "RECHAZADO",
    usuario: USUARIO,
  }),
});
revisar("Bloquear edición tras liberar", reEditar.status === 400, reEditar.body.error);

const activosDespues = await llamar("/api/quejas/programas?solo_activos=1");
revisar(
  "Liberado sale de Registro",
  !activosDespues.body.data?.some((row) => row.id === programaId),
);

// Limpieza
const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "incoming_react",
});
await connection.query("DELETE FROM quejas_checklist WHERE programa_id = ?", [programaId]);
await connection.query("DELETE FROM quejas_registros WHERE programa_id = ?", [programaId]);
await connection.query(
  "DELETE FROM adjuntos WHERE modulo = 'QUEJA' AND registro_id = ?",
  [programaId],
);
await connection.query("DELETE FROM quejas_programas WHERE id = ?", [programaId]);
await connection.query("DELETE FROM auditoria_eventos WHERE usuario = ?", [USUARIO]);
await unlink(path.join(process.cwd(), "uploads", "quejas", `${programaId}.pdf`)).catch(
  () => {},
);
const [sobrantes] = await connection.query(
  "SELECT COUNT(*) AS total FROM quejas_programas WHERE sap = 'ZZTEST999'",
);
await connection.end();

revisar("Limpieza de datos de prueba", sobrantes[0].total === 0);

for (const { nombre, ok, detalle } of resultados) {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? ` :: ${detalle}` : ""}`);
}
const fallas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - fallas}/${resultados.length} pruebas correctas`);
process.exit(fallas ? 1 : 0);
