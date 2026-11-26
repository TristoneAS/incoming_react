import ExcelJS from "exceljs";

export const PLANTILLA_NOMBRE = "plantilla_componentes.xlsx";
export const MAX_CARGA_BYTES = 5 * 1024 * 1024;
export const MAX_CARGA_FILAS = 1000;

const COLUMNAS = [
  { key: "sap", header: "SAP", required: true, width: 16 },
  { key: "componente", header: "Componente", required: true, width: 42 },
  {
    key: "categoria",
    header: "Categoria",
    required: true,
    width: 16,
    list: ["NUEVO", "SERIE", "SLOW_MOVER"],
  },
  {
    key: "clasificacion",
    header: "Clasificacion",
    required: true,
    width: 16,
    list: ["AA", "A", "B", "C"],
  },
  { key: "proveedor", header: "Proveedor", required: true, width: 22 },
  { key: "cliente", header: "Cliente", required: true, width: 18 },
  { key: "plataforma", header: "Plataforma", required: false, width: 16 },
  { key: "estandar_pack", header: "Estandar pack", required: false, width: 16 },
  {
    key: "caracteristica_critica",
    header: "Caracteristica critica",
    required: false,
    width: 24,
    list: ["NO", "SI"],
  },
  { key: "aql", header: "AQL", required: false, width: 12 },
];

const HEADER_ALIASES = {
  sap: "sap",
  "numero sap": "sap",
  componente: "componente",
  categoria: "categoria",
  clasificacion: "clasificacion",
  proveedor: "proveedor",
  cliente: "cliente",
  plataforma: "plataforma",
  "estandar pack": "estandar_pack",
  pack: "estandar_pack",
  "caracteristica critica": "caracteristica_critica",
  critica: "caracteristica_critica",
  aql: "aql",
};

const REQUIRED_KEYS = COLUMNAS.filter((column) => column.required).map(
  (column) => column.key,
);

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[*^]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cellText(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    if (value.richText) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if (value.text != null) return String(value.text).trim();
    if (value.result != null) return String(value.result).trim();
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function isEmptyRow(values) {
  return Object.values(values).every((value) => !String(value ?? "").trim());
}

export async function buildComponentesPlantilla() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Incoming";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Componentes", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = COLUMNAS.map((column) => ({
    header: column.required ? `${column.header} *` : column.header,
    key: column.key,
    width: column.width,
  }));

  const header = sheet.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF212A35" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF117A8B" } },
    };
  });

  const lastDataRow = MAX_CARGA_FILAS + 1;
  COLUMNAS.forEach((column, index) => {
    if (!column.list) return;
    const letter = sheet.getColumn(index + 1).letter;
    sheet.dataValidations.add(`${letter}2:${letter}${lastDataRow}`, {
      type: "list",
      allowBlank: !column.required,
      formulae: [`"${column.list.join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Valor no válido",
      error: `Usa uno de: ${column.list.join(", ")}`,
    });
  });

  const help = workbook.addWorksheet("Instrucciones");
  help.columns = [
    { width: 28 },
    { width: 88 },
  ];
  help.getCell("A1").value = "Carga masiva de componentes";
  help.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF212A35" } };
  help.mergeCells("A1:B1");

  const lines = [
    ["Hoja a llenar", "Usa la hoja Componentes. No cambies los encabezados de la fila 1."],
    ["Columnas con *", "Son obligatorias: SAP, Componente, Categoria, Clasificacion, Proveedor y Cliente."],
    ["Categoria", "NUEVO, SERIE o SLOW_MOVER."],
    ["Clasificacion", "AA, A, B o C."],
    ["Caracteristica critica", "SI o NO. Si lo dejas vacío se guarda como NO."],
    ["SAP nuevo", "Se crea el componente. El tipo de inspección inicia en Estricta."],
    ["SAP existente", "Se actualizan los datos del catálogo. No se cambia el tipo de inspección."],
    ["SAP eliminado", "Si el SAP ya existía y estaba dado de baja, se restaura y se actualiza."],
    ["Límite", `Hasta ${MAX_CARGA_FILAS} filas por archivo.`],
    ["Ejemplo SAP", "12345678"],
    ["Ejemplo Componente", "BUJE SUSPENSION"],
    ["Ejemplo Categoria", "SERIE"],
    ["Ejemplo Clasificacion", "A"],
    ["Ejemplo Proveedor", "MASEREL"],
    ["Ejemplo Cliente", "FORD"],
    ["Ejemplo Pack", "12"],
    ["Ejemplo AQL", "0.65"],
  ];
  lines.forEach((line, index) => {
    const row = help.getRow(index + 3);
    row.getCell(1).value = line[0];
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = line[1];
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function parseComponentesExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet =
    workbook.getWorksheet("Componentes") ||
    workbook.worksheets.find((item) => item.name !== "Instrucciones") ||
    workbook.worksheets[0];
  if (!sheet) {
    throw new Error("El archivo no tiene hojas para leer");
  }

  const headerMap = new Map();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const key = HEADER_ALIASES[normalizeHeader(cellText(cell.value))];
    if (key) headerMap.set(colNumber, key);
  });
  const found = new Set(headerMap.values());
  const missing = REQUIRED_KEYS.filter((key) => !found.has(key));
  if (missing.length) {
    throw new Error(
      "La plantilla no tiene las columnas esperadas. Descarga el formato otra vez.",
    );
  }

  const rows = [];
  const seen = new Set();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rowNumber > MAX_CARGA_FILAS + 1) {
      throw new Error(`El archivo supera el máximo de ${MAX_CARGA_FILAS} filas`);
    }
    const values = {};
    headerMap.forEach((key, colNumber) => {
      values[key] = cellText(row.getCell(colNumber).value);
    });
    if (isEmptyRow(values)) return;
    const sap = String(values.sap || "").trim().toUpperCase();
    if (sap && seen.has(sap)) {
      throw new Error(`El SAP ${sap} está repetido en el archivo (fila ${rowNumber})`);
    }
    if (sap) seen.add(sap);
    rows.push({ fila: rowNumber, values });
  });

  if (!rows.length) {
    throw new Error("El archivo no tiene filas para cargar");
  }
  return rows;
}
