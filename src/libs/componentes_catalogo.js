export const CATEGORIAS = new Set(["NUEVO", "SERIE", "SLOW_MOVER"]);
export const CLASIFICACIONES = new Set(["AA", "A", "B", "C"]);

export const clean = (value) => String(value ?? "").trim() || null;

export function validation(message) {
  const error = new Error(message);
  error.isValidation = true;
  return error;
}

function asFlag(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["1", "true", "si", "sí", "yes", "s"].includes(normalized) ? 1 : 0;
}

export function parseComponent(body) {
  const sap = clean(body.sap)?.toUpperCase();
  const categoria = clean(body.categoria)?.toUpperCase();
  const clasificacion = clean(body.clasificacion)?.toUpperCase();
  const componente = clean(body.componente)?.toUpperCase();
  const proveedor = clean(body.proveedor)?.toUpperCase();
  const cliente = clean(body.cliente)?.toUpperCase() || null;
  if (!sap) throw validation("El SAP es obligatorio");
  if (!CATEGORIAS.has(categoria)) throw validation("Selecciona una categoría válida");
  if (!CLASIFICACIONES.has(clasificacion)) {
    throw validation("Selecciona una clasificación AA, A, B o C");
  }
  if (!componente) throw validation("El nombre del componente es obligatorio");
  if (!proveedor) throw validation("El proveedor es obligatorio");
  if (!cliente) throw validation("El cliente es obligatorio");
  return {
    sap,
    categoria,
    clasificacion,
    componente,
    proveedor,
    estandarPack: clean(body.estandar_pack)?.toUpperCase() || null,
    plataforma: clean(body.plataforma)?.toUpperCase() || null,
    critica: asFlag(body.caracteristica_critica),
    aql: clean(body.aql),
    cliente,
    usuario: clean(body.usuario),
  };
}

export async function assertClasificacion(connection, clasificacion) {
  const [rows] = await connection.execute(
    "SELECT clasificacion FROM clasificacion_reglas WHERE clasificacion = ? LIMIT 1",
    [clasificacion],
  );
  if (!rows.length) {
    throw validation(
      `No existe la regla de clasificación ${clasificacion}. Carga primero el catálogo clasificacion_reglas.`,
    );
  }
}

export async function auditComponente(connection, id, action, usuario, detail = null) {
  await connection.execute(
    `INSERT INTO auditoria_eventos
     (modulo, registro_id, accion, usuario, detalle)
     VALUES ('COMPONENTE', ?, ?, ?, ?)`,
    [id, action, usuario, detail ? JSON.stringify(detail) : null],
  );
}
