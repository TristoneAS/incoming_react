/** Aplica las migraciones idempotentes del proyecto. */
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const migrations = [
  "../sql/migracion_liberar.sql",
  "../sql/migracion_componentes.sql",
  "../sql/migracion_catalogo_aql.sql",
  "../sql/migracion_tipo_inspeccion_auto.sql",
  "../sql/migracion_aql_muestras.sql",
  "../sql/migracion_catalogo_cliente.sql",
  "../sql/migracion_sorteos_pack.sql",
];

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "incoming_react",
  multipleStatements: true,
});

for (const migration of migrations) {
  const sql = await readFile(new URL(migration, import.meta.url), "utf8");
  await connection.query(sql);
  console.log(`Aplicada: ${migration}`);
}
const [columns] = await connection.query("SHOW COLUMNS FROM auditoria_eventos LIKE 'accion'");
console.log("accion =>", columns[0].Type);
await connection.end();
