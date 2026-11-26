import ExcelJS from "exceljs";

export const MAX_EXCEL_ROWS = 5000;

export function sanitizeFilename(name) {
  const base = String(name || "reporte")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base.toLowerCase().endsWith(".xlsx") ? base : `${base || "reporte"}.xlsx`;
}

function cellValue(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

export async function buildExcelBuffer({ sheet, columns, rows }) {
  if (!Array.isArray(columns) || !columns.length) {
    throw new Error("No hay columnas para exportar");
  }
  if (!Array.isArray(rows)) {
    throw new Error("No hay filas para exportar");
  }
  if (rows.length > MAX_EXCEL_ROWS) {
    throw new Error(`El reporte supera el máximo de ${MAX_EXCEL_ROWS} filas`);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Incoming";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(String(sheet || "Datos").slice(0, 31) || "Datos");
  worksheet.columns = columns.map((header) => ({
    header: String(header),
    width: Math.min(42, Math.max(12, String(header).length + 6)),
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF212A35" },
    };
    cell.alignment = { vertical: "middle" };
  });

  rows.forEach((row) => {
    const values = columns.map((_, index) =>
      cellValue(Array.isArray(row) ? row[index] : row?.[index]),
    );
    worksheet.addRow(values);
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
