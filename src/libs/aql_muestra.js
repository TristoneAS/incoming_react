const TABLAS_MUESTRA = {
  ESTRICTA: "aql_muestras_estricta",
  NORMAL: "aql_muestras_normal",
  REDUCIDA: "aql_muestras_reducida",
};

function validation(message) {
  const error = new Error(message);
  error.isValidation = true;
  return error;
}

export function parseTamanoLote(value) {
  const lote = Number(String(value ?? "").replace(/,/g, "").trim());
  if (!Number.isInteger(lote) || lote < 1) {
    throw validation("Indica el tamaño de lote (número entero mayor a 0)");
  }
  return lote;
}

/**
 * Nivel II: tamaño de lote → letra. Luego Estricta/Normal/Reducida → muestra.
 * Skip lot no toma muestras. Si la muestra supera el lote, se inspecciona el lote completo.
 */
export async function resolverMuestra(connection, componenteId, tamanoLoteRaw) {
  const tamanoLote = parseTamanoLote(tamanoLoteRaw);
  const [componentes] = await connection.execute(
    `SELECT id, sap, tipo_inspeccion
     FROM componentes
     WHERE id = ? AND eliminado_en IS NULL
     LIMIT 1`,
    [componenteId],
  );
  if (!componentes.length) {
    throw validation("El componente seleccionado no existe o está eliminado");
  }
  const tipo = componentes[0].tipo_inspeccion;
  const [letras] = await connection.execute(
    `SELECT letra
     FROM aql_lote_letra
     WHERE lote_min <= ?
       AND (lote_max IS NULL OR lote_max >= ?)
     ORDER BY lote_min DESC
     LIMIT 1`,
    [tamanoLote, tamanoLote],
  );
  if (!letras.length) {
    throw validation("No hay letra de muestra para ese tamaño de lote (mínimo 2 piezas)");
  }
  const letra = letras[0].letra;
  if (tipo === "SKIP_LOT") {
    return {
      tipo_inspeccion: tipo,
      letra,
      tamano_lote: tamanoLote,
      muestra: 0,
      skip_lot: true,
    };
  }
  const tabla = TABLAS_MUESTRA[tipo];
  if (!tabla) {
    throw validation("El tipo de inspección del componente no permite calcular muestra");
  }
  const [filas] = await connection.execute(
    `SELECT muestra FROM ${tabla} WHERE letra = ? LIMIT 1`,
    [letra],
  );
  if (!filas.length) {
    throw validation(`No hay tamaño de muestra ${tipo.toLowerCase()} para la letra ${letra}`);
  }
  const muestra = Math.min(Number(filas[0].muestra), tamanoLote);
  return {
    tipo_inspeccion: tipo,
    letra,
    tamano_lote: tamanoLote,
    muestra,
    skip_lot: false,
  };
}
