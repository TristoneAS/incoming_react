/** Cada 10 revisiones conformes consecutivas del mismo SAP sube un nivel. */
export const INSPECCION_RACHA = 10;
export const TIPOS_POR_RACHA = ["ESTRICTA", "NORMAL", "REDUCIDA", "SKIP_LOT"];

export function tipoDesdeRacha(consecutivasOk) {
  const nivel = Math.min(
    TIPOS_POR_RACHA.length - 1,
    Math.floor(Math.max(0, Number(consecutivasOk) || 0) / INSPECCION_RACHA),
  );
  return TIPOS_POR_RACHA[nivel];
}

/**
 * Recalcula el tipo de inspección del componente según la racha de
 * revisiones CONFORME del mismo SAP (de la más reciente hacia atrás).
 * Una sola NO_CONFORME reinicia a ESTRICTA.
 */
export async function syncTipoInspeccion(connection, componenteId, usuario = null) {
  if (!componenteId) return null;
  const [componentes] = await connection.execute(
    "SELECT id, sap, tipo_inspeccion FROM componentes WHERE id = ? LIMIT 1",
    [componenteId],
  );
  if (!componentes.length) return null;
  const sap = componentes[0].sap;
  const [revisiones] = await connection.execute(
    `SELECT r.resultado
     FROM componente_revisiones r
     INNER JOIN componentes c ON c.id = r.componente_id
     WHERE c.sap = ? AND r.eliminado_en IS NULL
     ORDER BY r.fecha DESC, r.id DESC`,
    [sap],
  );
  let racha = 0;
  for (const row of revisiones) {
    if (row.resultado !== "CONFORME") break;
    racha += 1;
  }
  const tipo = tipoDesdeRacha(racha);
  if (tipo === componentes[0].tipo_inspeccion) return tipo;
  await connection.execute(
    `UPDATE componentes
     SET tipo_inspeccion = ?, actualizado_por = COALESCE(?, actualizado_por)
     WHERE sap = ? AND eliminado_en IS NULL`,
    [tipo, usuario, sap],
  );
  await connection.execute(
    `INSERT INTO auditoria_eventos
     (modulo, registro_id, accion, usuario, detalle)
     VALUES ('COMPONENTE', ?, 'EDITAR', ?, ?)`,
    [
      componenteId,
      usuario,
      JSON.stringify({
        tipo_inspeccion: tipo,
        racha_conforme: racha,
        origen: "auto_revision",
      }),
    ],
  );
  return tipo;
}
