import { readFile } from "node:fs/promises";
import path from "node:path";

function unique(paths) {
  return [...new Set(paths.filter(Boolean))];
}

function resolveCandidate(filePath) {
  if (!filePath) return [];
  if (path.isAbsolute(filePath)) return [filePath];
  return [path.join(process.cwd(), filePath)];
}

/**
 * Lee un PDF desde varias rutas posibles. Turbopack exige que el acceso
 * quede acotado a una subcarpeta conocida (`uploads/...`).
 */
export async function readPdfFromCandidates(candidates, nombre) {
  const errors = [];
  for (const ruta of unique(candidates.flatMap(resolveCandidate))) {
    try {
      return {
        buffer: await readFile(/* turbopackIgnore: true */ ruta),
        nombre,
        ruta,
      };
    } catch (error) {
      errors.push(`${ruta} → ${error.code || error.message}`);
    }
  }
  if (errors.length) {
    console.error("No se pudo leer el PDF:\n", errors.join("\n"));
  }
  return null;
}

export function joinUpload(...parts) {
  return path.join(process.cwd(), "uploads", ...parts);
}
