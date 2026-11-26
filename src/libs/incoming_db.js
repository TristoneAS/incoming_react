import mysql from "mysql2/promise";

export const incomingDb = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || "incoming_react",
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  dateStrings: true,
});

export async function query(sql, params = []) {
  const [rows] = await incomingDb.execute(sql, params);
  return rows;
}
