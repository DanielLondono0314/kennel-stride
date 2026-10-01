import Papa from "papaparse";
import * as XLSX from "xlsx";
import { decodeCsvBytes, toIsoDate } from "@/lib/importParsing";

export function isExcelFile(file: File): boolean {
  return (
    /\.xlsx?$/i.test(file.name) ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  );
}

/**
 * Filas planas de una hoja. Las celdas de fecha se convierten a aaaa-mm-dd
 * desde su valor real: el texto formateado depende del formato de celda
 * (p. ej. "5/10/26" en mm-dd-yy) y es ambiguo.
 */
function sheetRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  for (const addr of Object.keys(sheet)) {
    if (addr.startsWith("!")) continue;
    const cell = sheet[addr] as XLSX.CellObject;
    if (cell.t === "n" && typeof cell.v === "number" && cell.z && XLSX.SSF.is_date(cell.z)) {
      const p = XLSX.SSF.parse_date_code(cell.v);
      const iso = toIsoDate(p.y, p.m, p.d);
      sheet[addr] = { t: "s", v: iso, w: iso };
    }
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
}

async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  return XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array", cellNF: true });
}

/** Primera hoja de un .xlsx/.xls. */
export async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  const workbook = await readWorkbook(file);
  const sheetName = workbook.SheetNames[0];
  return sheetName ? sheetRows(workbook.Sheets[sheetName]) : [];
}

/** CSV: se decodifica a mano para soportar los CSV Windows-1252 de Excel. */
export async function parseCsvFile(file: File): Promise<{ rows: Record<string, unknown>[]; warnings: number }> {
  const text = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
  const res = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: "greedy" });
  return { rows: res.data, warnings: res.errors.length };
}

export interface ImportSheet {
  /** "archivo.csv" o "archivo.xlsx · Hoja". */
  name: string;
  rows: Record<string, unknown>[];
}

/** Un CSV es una hoja; un Excel aporta cada hoja que tenga datos. */
export async function readImportSheets(file: File): Promise<ImportSheet[]> {
  if (!isExcelFile(file)) return [{ name: file.name, rows: (await parseCsvFile(file)).rows }];
  const workbook = await readWorkbook(file);
  return workbook.SheetNames
    .map((s) => ({ name: workbook.SheetNames.length > 1 ? `${file.name} · ${s}` : file.name, rows: sheetRows(workbook.Sheets[s]) }))
    .filter((s) => s.rows.length > 0);
}
