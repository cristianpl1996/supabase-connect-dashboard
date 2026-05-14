import * as XLSX from "xlsx";
import type { ApiListResponse } from "@/lib/api";

const EXPORT_PAGE_SIZE = 2000;

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export async function fetchAllPagesParallel<T, P extends { limit?: number; offset?: number }>(
  fetchPage: (params: P) => Promise<ApiListResponse<T>>,
  params: P,
  pageSize = EXPORT_PAGE_SIZE,
): Promise<T[]> {
  const first = await fetchPage({ ...params, limit: pageSize, offset: 0 });
  const firstBatch = first.data ?? [];
  const total = Number.isFinite(first.meta?.count) ? Number(first.meta.count) : firstBatch.length;

  if (total <= firstBatch.length) return firstBatch;

  const requests: Array<Promise<ApiListResponse<T>>> = [];
  for (let offset = firstBatch.length; offset < total; offset += pageSize) {
    requests.push(fetchPage({ ...params, limit: pageSize, offset }));
  }

  const pages = await Promise.all(requests);
  return [firstBatch, ...pages.map((page) => page.data ?? [])].flat();
}

export function exportRowsToWorkbook<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  fileName: string,
  sheetName: string,
) {
  const data = rows.map((row) =>
    columns.reduce<Record<string, unknown>>((acc, column) => {
      acc[column.header] = normalizeCellValue(column.value(row));
      return acc;
    }, {}),
  );

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

export function buildExportFileName(prefix: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${prefix}-${year}${month}${day}-${hours}${minutes}.xlsx`;
}
