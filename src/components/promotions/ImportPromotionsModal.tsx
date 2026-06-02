import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
  Upload, Download, FileSpreadsheet, X, Tag,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  Loader2, CheckCheck, Users, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  importPromotions, getAllProducts, getAllCustomers,
  PromotionImportRowPayload, ProductCatalogItem, CustomerRecord,
} from '@/lib/api';
import { Laboratory } from '@/types/database';
import { toast } from 'sonner';
import { StepsProgress } from './StepsProgress';

interface ImportPromotionsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onDownloadingChange?: (downloading: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  laboratories: Laboratory[];
}

type ModalState = 'idle' | 'parsing' | 'preview' | 'importing' | 'result';

interface CampaignGroup {
  key: string;
  labName: string;
  title: string;
  startDate: string;
  endDate: string;
  productNames: string[];
  skus: string[];
  tipoMecanica: string;
  mechanicSummary: string;
  scopeLabel: string;
  customerNames: string[];
  customerIds: string[];
  rows: PromotionImportRowPayload[];
  errors: string[];
  isValid: boolean;
}

interface ParsedImportRow {
  laboratory: string;
  title: string;
  origin: string | null;
  start_date: string;
  end_date: string;
  productos_raw: string;
  tipo_mecanica: string;
  base_cantidad: number | null;
  bonus_cantidad: number | null;
  porcentaje_descuento: number | null;
  alcance: string | null;
  clientes_raw: string;
  rowNumber: number;
}

interface ImportResult {
  imported_count: number;
  skipped_count: number;
  errors: string[];
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatExcelDate(value: unknown): string {
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    const d = String(date.d).padStart(2, '0');
    const m = String(date.m).padStart(2, '0');
    return `${date.y}-${m}-${d}`;
  }
  if (typeof value === 'string') {
    const v = value.trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
      const [d, m, y] = v.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  }
  return String(value ?? '');
}

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !isNaN(new Date(s).getTime());
}

function displayDate(s: string): string {
  if (!isValidDate(s)) return s;
  try {
    return new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  } catch { return s; }
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function nextMonthStr() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_MECANICAS = ['bonificacion', 'descuento'];
const TITLE_FORBIDDEN = /[%\[\]{}<>@#&*^~`\\|]/;
const VALID_ORIGINS = ['dinamica comercial', 'recurso propio'];
const SCOPE_CUSTOMERS_VALUES = ['clientes especificos', 'clientes_especificos', 'customers', 'especificos'];

function resolveScope(alcance: string | null | undefined): 'all' | 'customers' {
  return SCOPE_CUSTOMERS_VALUES.includes((alcance ?? '').trim().toLowerCase()) ? 'customers' : 'all';
}

function normalizeForLookup(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function buildProductMap(products: ProductCatalogItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of products) {
    if (!p.product_sku) continue;
    const name = p.product_commercial_name ?? '';
    if (name) map.set(normalizeForLookup(name), p.product_sku);
  }
  return map;
}

function buildCustomerMap(customers: CustomerRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of customers) {
    const nit = String(c['customer_government_id'] ?? '');
    if (!nit) continue;
    const name = String(c['customer_full_name'] ?? c['customer_commercial_name'] ?? c['customer_name'] ?? '');
    if (name) map.set(normalizeForLookup(name), nit);
  }
  return map;
}

function resolveNames(
  parsed: ParsedImportRow,
  productMap: Map<string, string>,
  customerMap: Map<string, string>,
): { rows: PromotionImportRowPayload[]; errors: string[] } {
  const n = parsed.rowNumber;
  const errors: string[] = [];

  const productNames = parsed.productos_raw.split(',').flatMap((s) => { const t = s.trim(); return t ? [t] : []; });
  if (productNames.length === 0) errors.push(`Fila ${n}: Productos requerido`);

  const skus: string[] = [];
  for (const name of productNames) {
    const sku = productMap.get(normalizeForLookup(name));
    if (sku) skus.push(sku);
    else errors.push(`Fila ${n}: Producto no encontrado: "${name}"`);
  }

  const scope = resolveScope(parsed.alcance);
  const customerIds: string[] = [];
  if (scope === 'customers') {
    const names = parsed.clientes_raw.split(',').flatMap((s) => { const t = s.trim(); return t ? [t] : []; });
    for (const name of names) {
      const id = customerMap.get(normalizeForLookup(name));
      if (id) customerIds.push(id);
      else errors.push(`Fila ${n}: Cliente no encontrado: "${name}"`);
    }
  }

  const clientes = customerIds.length > 0 ? customerIds.join(', ') : null;
  const rows: PromotionImportRowPayload[] = skus.map((sku) => ({
    laboratory: parsed.laboratory,
    title: parsed.title,
    origin: parsed.origin,
    start_date: parsed.start_date,
    end_date: parsed.end_date,
    sku,
    tipo_mecanica: parsed.tipo_mecanica,
    base_cantidad: parsed.base_cantidad,
    bonus_cantidad: parsed.bonus_cantidad,
    porcentaje_descuento: parsed.porcentaje_descuento,
    alcance: parsed.alcance,
    clientes,
  }));

  return { rows, errors };
}

function validateAndGroup(
  parsedRows: ParsedImportRow[],
  laboratories: Laboratory[],
  productMap: Map<string, string>,
  customerMap: Map<string, string>,
): CampaignGroup[] {
  const labNamesLower = new Set(laboratories.map((l) => l.name.trim().toLowerCase()));

  return parsedRows.map((row, idx) => {
    const n = row.rowNumber;
    const errs: string[] = [];

    if (!row.laboratory?.trim()) errs.push(`Fila ${n}: Laboratorio requerido`);
    else if (!labNamesLower.has(row.laboratory.trim().toLowerCase()))
      errs.push(`Fila ${n}: Laboratorio "${row.laboratory.trim()}" no encontrado en el sistema`);

    if (!row.title?.trim()) errs.push(`Fila ${n}: Titulo requerido`);
    else if (TITLE_FORBIDDEN.test(row.title.trim()))
      errs.push(`Fila ${n}: Título contiene caracteres no permitidos (%, [, ], {, }, @, etc.)`);

    if (!row.start_date) errs.push(`Fila ${n}: Fecha_Inicio requerida`);
    else if (!isValidDate(row.start_date)) errs.push(`Fila ${n}: Fecha_Inicio "${row.start_date}" invalida (usar DD/MM/YYYY)`);

    if (!row.end_date) errs.push(`Fila ${n}: Fecha_Fin requerida`);
    else if (!isValidDate(row.end_date)) errs.push(`Fila ${n}: Fecha_Fin "${row.end_date}" invalida (usar DD/MM/YYYY)`);

    if (isValidDate(row.start_date) && isValidDate(row.end_date) && row.start_date > row.end_date)
      errs.push(`Fila ${n}: Fecha_Inicio debe ser anterior o igual a Fecha_Fin`);

    const mecanica = (row.tipo_mecanica ?? '').trim().toLowerCase();
    if (!mecanica) {
      errs.push(`Fila ${n}: Tipo_Mecanica requerido`);
    } else if (!VALID_MECANICAS.includes(mecanica)) {
      errs.push(`Fila ${n}: Tipo_Mecanica debe ser "bonificacion" o "descuento" (recibido: "${mecanica}")`);
    } else if (mecanica === 'bonificacion') {
      if (!row.base_cantidad || row.base_cantidad < 1)
        errs.push(`Fila ${n}: Base_Cantidad requerida y debe ser >= 1`);
      if (!row.bonus_cantidad || row.bonus_cantidad < 1)
        errs.push(`Fila ${n}: Bonus_Cantidad requerida y debe ser >= 1`);
    } else if (mecanica === 'descuento') {
      if (row.porcentaje_descuento == null)
        errs.push(`Fila ${n}: Porcentaje_Descuento requerido para descuento`);
      else if (row.porcentaje_descuento < 0 || row.porcentaje_descuento > 100)
        errs.push(`Fila ${n}: Porcentaje_Descuento debe estar entre 0 y 100`);
    }

    const originVal = (row.origin ?? '').trim().toLowerCase();
    if (!originVal) {
      errs.push(`Fila ${n}: Origen requerido ("Dinamica comercial" o "Recurso propio")`);
    } else if (!VALID_ORIGINS.includes(originVal)) {
      errs.push(`Fila ${n}: Origen debe ser "Dinamica comercial" o "Recurso propio" (recibido: "${row.origin}")`);
    }

    const alcanceRaw = (row.alcance ?? '').trim().toLowerCase();
    if (alcanceRaw && resolveScope(row.alcance) === 'all' && !['toda la base', 'all', 'todos', ''].includes(alcanceRaw))
      errs.push(`Fila ${n}: Alcance debe ser "Toda la base" o "Clientes especificos"`);

    if (resolveScope(row.alcance) === 'customers' && !row.clientes_raw.trim())
      errs.push(`Fila ${n}: Columna Clientes requerida cuando Alcance = "Clientes especificos"`);

    const { rows: expandedRows, errors: resolutionErrors } = resolveNames(row, productMap, customerMap);
    errs.push(...resolutionErrors);

    let mechanicSummary = mecanica;
    if (mecanica === 'bonificacion' && row.base_cantidad && row.bonus_cantidad)
      mechanicSummary = `Bonificacion ${row.base_cantidad}+${row.bonus_cantidad}`;
    else if (mecanica === 'bonificacion') mechanicSummary = 'Bonificacion';
    else if (mecanica === 'descuento' && row.porcentaje_descuento != null)
      mechanicSummary = `Descuento ${row.porcentaje_descuento}%`;
    else if (mecanica === 'descuento') mechanicSummary = 'Descuento';

    const scope = resolveScope(row.alcance);
    const scopeLabel = scope === 'customers' ? 'Clientes especificos' : 'Toda la base';
    const productNames = row.productos_raw.split(',').flatMap((s) => { const t = s.trim(); return t ? [t] : []; });
    const customerNames = scope === 'customers'
      ? row.clientes_raw.split(',').flatMap((s) => { const t = s.trim(); return t ? [t] : []; })
      : [];

    const allErrors = [...new Set(errs)];
    return {
      key: String(idx),
      labName: row.laboratory?.trim() ?? '',
      title: row.title?.trim() ?? '',
      startDate: row.start_date ?? '',
      endDate: row.end_date ?? '',
      productNames,
      skus: expandedRows.flatMap((r) => r.sku ? [r.sku] : []),
      tipoMecanica: mecanica,
      mechanicSummary,
      scopeLabel,
      customerNames,
      customerIds: scope === 'customers'
        ? (expandedRows[0]?.clientes ?? '').split(',').flatMap((s) => { const t = s.trim(); return t ? [t] : []; })
        : [],
      rows: expandedRows,
      errors: allErrors,
      isValid: allErrors.length === 0,
    };
  });
}

// ─── Template download (with real data) ──────────────────────────────────────

async function buildAndDownloadTemplate(
  laboratories: Laboratory[],
  products: ProductCatalogItem[],
  customers: CustomerRecord[],
) {
  const labNames = laboratories.flatMap((l) => { const n = l.name.trim(); return n ? [n] : []; });
  const productRows = products
    .filter((p) => p.product_sku)
    .map((p) => [p.product_commercial_name ?? '', p.product_sku, p.product_brand_name ?? ''] as const);
  const custRows = customers
    .map((c) => [
      String(c['customer_full_name'] ?? c['customer_commercial_name'] ?? c['customer_name'] ?? ''),
      String(c['customer_government_id'] ?? ''),
    ] as const)
    .filter((r) => r[1]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IVANagro';

  const GREEN_DARK  = 'FF1A5C38';
  const GREEN_MID   = 'FF2D8653';
  const GREEN_LIGHT = 'FFD6F0E0';
  const GREEN_PALE  = 'FFEDF8F1';

  const styleRefHeader = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_MID } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    ws.getRow(1).height = 18;
  };

  // ── Sheet 1: Promociones ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsMain = wb.addWorksheet('Promociones') as any;
  wsMain.columns = [
    { header: 'Laboratorio',          key: 'lab',      width: 30 },
    { header: 'Titulo',               key: 'titulo',   width: 34 },
    { header: 'Origen',               key: 'origen',   width: 24 },
    { header: 'Fecha_Inicio',         key: 'fi',       width: 14 },
    { header: 'Fecha_Fin',            key: 'ff',       width: 14 },
    { header: 'Productos',            key: 'productos', width: 48 },
    { header: 'Tipo_Mecanica',        key: 'mecanica', width: 18 },
    { header: 'Base_Cantidad',        key: 'base',     width: 15 },
    { header: 'Bonus_Cantidad',       key: 'bonus',    width: 16 },
    { header: 'Porcentaje_Descuento', key: 'pct',      width: 22 },
    { header: 'Alcance',              key: 'alcance',  width: 24 },
    { header: 'Clientes',             key: 'clientes', width: 50 },
  ];

  const headerRow = wsMain.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_DARK } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF0F3D26' } } };
  });
  headerRow.height = 22;
  wsMain.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Nota de referencia en col M
  const noteCell = wsMain.getCell('M1');
  noteCell.value = 'Ver hojas "Productos" y "Clientes" para nombres exactos';
  noteCell.font = { italic: true, size: 9, color: { argb: GREEN_MID } };
  noteCell.alignment = { vertical: 'middle' };

  // Filas de ejemplo
  const today = todayStr();
  const nextMonth = nextMonthStr();
  const ex1Lab = labNames[0] ?? 'Nombre del Laboratorio';
  const ex1Products = productRows.slice(0, 2).flatMap((r) => r[0] ? [r[0]] : []).join(', ') || 'Producto A, Producto B';
  const ex2Products = productRows[2]?.[0] || 'Producto C';
  const exCustNames = custRows.slice(0, 2).flatMap((r) => r[0] ? [r[0]] : []).join(', ') || 'Cliente Uno, Cliente Dos';

  wsMain.addRow([ex1Lab, 'BONIFICADO 10+1 JUNIO',     'Dinamica comercial', today, nextMonth, ex1Products, 'bonificacion', 10, 1, '',  'Toda la base',         '']);
  wsMain.addRow([ex1Lab, 'DESCUENTO 3% CLIENTES VIP', 'Recurso propio',     today, nextMonth, ex2Products, 'descuento',    '',  '', 3,   'Clientes especificos', exCustNames]);

  for (let r = 2; r <= 3; r++) {
    wsMain.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 === 0 ? GREEN_LIGHT : GREEN_PALE } };
      cell.font = { name: 'Calibri', size: 10 };
    });
  }

  // Dropdowns (A=Lab, C=Origen, G=Mecanica, K=Alcance; F y L son texto libre)
  const labEnd = labNames.length + 1;

  wsMain.dataValidations.add('A2:A10000', {
    type: 'list', allowBlank: true,
    formulae: [`Referencia!$A$2:$A$${labEnd}`],
    showErrorMessage: true, errorStyle: 'error',
    errorTitle: 'Laboratorio invalido',
    error: 'Selecciona un laboratorio de la lista',
  });
  wsMain.dataValidations.add('C2:C10000', {
    type: 'list', allowBlank: true,
    formulae: ['"Dinamica comercial,Recurso propio"'],
    showErrorMessage: true, errorStyle: 'warning',
    errorTitle: 'Origen invalido',
    error: 'Debe ser "Dinamica comercial" o "Recurso propio"',
  });
  wsMain.dataValidations.add('G2:G10000', {
    type: 'list', allowBlank: true,
    formulae: ['"bonificacion,descuento"'],
    showErrorMessage: true, errorStyle: 'error',
    errorTitle: 'Mecanica invalida',
    error: 'Debe ser "bonificacion" o "descuento"',
  });
  wsMain.dataValidations.add('K2:K10000', {
    type: 'list', allowBlank: true,
    formulae: ['"Toda la base,Clientes especificos"'],
    showErrorMessage: true, errorStyle: 'warning',
    errorTitle: 'Alcance invalido',
    error: 'Debe ser "Toda la base" o "Clientes especificos"',
  });

  // ── Sheet 2: Instrucciones ──
  const wsInstr = wb.addWorksheet('Instrucciones');
  wsInstr.columns = [{ width: 24 }, { width: 72 }, { width: 40 }, { width: 32 }];

  const instrRows: (string | null)[][] = [
    ['GUIA DE IMPORTACION MASIVA DE PROMOCIONES', null, null, null],
    [null, null, null, null],
    ['ESTRUCTURA DEL ARCHIVO', null, null, null],
    ['Cada fila es UNA promocion completa. Los campos Productos y Clientes aceptan multiples valores separados por coma.', null, null, null],
    [null, null, null, null],
    ['COLUMNAS DEL ARCHIVO', null, null, null],
    ['Columna', 'Descripcion', 'Valores validos', 'Requerido'],
    ['Laboratorio', 'Nombre exacto del lab. Usar el dropdown.', 'Ver desplegable', 'Si'],
    ['Titulo', 'Nombre de la campana.', 'Texto libre', 'Si'],
    ['Origen', 'Origen comercial de la promocion.', 'Dinamica comercial | Recurso propio', 'No'],
    ['Fecha_Inicio', 'Fecha de inicio de vigencia.', 'DD/MM/YYYY', 'Si'],
    ['Fecha_Fin', 'Fecha de fin de vigencia.', 'DD/MM/YYYY', 'Si'],
    ['Productos', 'Nombres de productos separados por coma. Ver hoja "Productos" para nombres exactos.', 'Texto libre (nombres exactos)', 'Si'],
    ['Tipo_Mecanica', 'Tipo de beneficio.', 'bonificacion | descuento', 'Si'],
    ['Base_Cantidad', 'Cantidad a comprar. Ej: 10 para escala 10+1.', 'Entero >= 1', 'Si (solo bonificacion)'],
    ['Bonus_Cantidad', 'Cantidad bonificada. Ej: 1 para 10+1.', 'Entero >= 1', 'Si (solo bonificacion)'],
    ['Porcentaje_Descuento', 'Descuento sobre el precio. Ej: 3 para 3%.', '0 a 100', 'Si (solo descuento)'],
    ['Alcance', 'A quienes aplica.', 'Toda la base | Clientes especificos', 'No (default: Toda la base)'],
    ['Clientes', 'Nombres de clientes separados por coma. Ver hoja "Clientes" para nombres exactos.', 'Texto libre (nombres exactos)', 'Si (si Alcance = Clientes especificos)'],
    [null, null, null, null],
    [`Datos cargados: ${labNames.length} laboratorios, ${productRows.length} productos, ${custRows.length} clientes.`, null, null, null],
  ];
  for (const row of instrRows) wsInstr.addRow(row);

  wsInstr.getCell('A1').font = { bold: true, size: 14, color: { argb: GREEN_DARK }, name: 'Calibri' };
  wsInstr.getRow(7).eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_MID } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle' };
  });
  wsInstr.getRow(7).height = 18;
  wsInstr.getRow(3).font = { bold: true, size: 11, color: { argb: GREEN_DARK } };
  wsInstr.getRow(6).font = { bold: true, size: 11, color: { argb: GREEN_DARK } };

  // ── Sheet 3: Productos (referencia para col F) ──
  const wsProducts = wb.addWorksheet('Productos');
  wsProducts.columns = [
    { header: 'Nombre_Producto', width: 52 },
    { header: 'SKU',             width: 18 },
    { header: 'Marca',           width: 24 },
  ];
  styleRefHeader(wsProducts);
  for (const p of productRows) wsProducts.addRow([p[0], p[1], p[2]]);

  // ── Sheet 4: Clientes (referencia para col L) ──
  const wsCustomers = wb.addWorksheet('Clientes');
  wsCustomers.columns = [
    { header: 'Nombre_Cliente', width: 52 },
    { header: 'NIT_Cedula',     width: 20 },
  ];
  styleRefHeader(wsCustomers);
  for (const c of custRows) wsCustomers.addRow([c[0], c[1]]);

  // ── Sheet 5: Referencia (solo labs, para el dropdown de col A) ──
  const wsRef = wb.addWorksheet('Referencia');
  wsRef.columns = [{ header: 'Laboratorio', width: 32 }];
  styleRefHeader(wsRef);
  for (const lab of labNames) wsRef.addRow([lab]);

  // ── Descarga ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_promociones.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── File parsing ─────────────────────────────────────────────────────────────

function parseFile(file: File): Promise<ParsedImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array', cellDates: false });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        if (jsonData.length === 0) return reject(new Error('El archivo esta vacio'));

        const rows: ParsedImportRow[] = jsonData.map((row, index) => ({
          laboratory: String(row['Laboratorio'] ?? '').trim(),
          title: String(row['Titulo'] ?? '').trim(),
          origin: row['Origen'] ? String(row['Origen']).trim() : null,
          start_date: formatExcelDate(row['Fecha_Inicio']),
          end_date: formatExcelDate(row['Fecha_Fin']),
          productos_raw: String(row['Productos'] ?? '').trim(),
          tipo_mecanica: String(row['Tipo_Mecanica'] ?? '').trim().toLowerCase(),
          base_cantidad: row['Base_Cantidad'] != null && String(row['Base_Cantidad']).trim() !== '' ? Number(row['Base_Cantidad']) : null,
          bonus_cantidad: row['Bonus_Cantidad'] != null && String(row['Bonus_Cantidad']).trim() !== '' ? Number(row['Bonus_Cantidad']) : null,
          porcentaje_descuento: row['Porcentaje_Descuento'] != null && String(row['Porcentaje_Descuento']).trim() !== '' ? Number(row['Porcentaje_Descuento']) : null,
          alcance: row['Alcance'] ? String(row['Alcance']).trim() : null,
          clientes_raw: row['Clientes'] ? String(row['Clientes']).trim() : '',
          rowNumber: index + 2,
        }));

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportPromotionsModal({ open, onClose, onSuccess, onDownloadingChange, onBusyChange, laboratories }: ImportPromotionsModalProps) {
  const [modalState, setModalState] = useState<ModalState>('idle');
  const [groups, setGroups] = useState<CampaignGroup[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [parsingStep, setParsingStep] = useState(0);
  const [parsingProgress, setParsingProgress] = useState(0);
  const [importingStep, setImportingStep] = useState(0);
  const [importingProgress, setImportingProgress] = useState(0);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadLabel, setDownloadLabel] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PARSING_STEPS = ['Leyendo archivo Excel…', 'Descargando catálogo de productos…', 'Descargando datos de clientes…', 'Validando y agrupando campañas…'];
  const IMPORTING_STEPS = ['Validando campañas...', 'Guardando en Ivanagro...', 'Finalizando importación...'];

  useEffect(() => {
    if (modalState !== 'parsing') { setParsingStep(0); setParsingProgress(0); return; }
    setParsingStep(0); setParsingProgress(5);
    const stepMs = [900, 1800, 2700];
    const timers = stepMs.map((ms, i) => window.setTimeout(() => setParsingStep(i + 1), ms));
    let p = 5;
    const ticker = setInterval(() => { p = Math.min(p + 1.2, 92); setParsingProgress(Math.round(p)); }, 120);
    return () => { timers.forEach(clearTimeout); clearInterval(ticker); };
  }, [modalState]);

  useEffect(() => {
    if (modalState !== 'importing') { setImportingStep(0); setImportingProgress(0); return; }
    setImportingStep(0); setImportingProgress(5);
    const stepTimers = [
      window.setTimeout(() => setImportingStep(1), 800),
      window.setTimeout(() => setImportingStep(2), 1800),
    ];
    let p = 5;
    const ticker = setInterval(() => { p = Math.min(p + 1.2, 90); setImportingProgress(Math.round(p)); }, 120);
    return () => { stepTimers.forEach(clearTimeout); clearInterval(ticker); };
  }, [modalState]);

  const reset = useCallback(() => {
    setModalState('idle');
    setGroups([]);
    setFileName('');

    setResult(null);
    setErrorsExpanded(false);
    setExpandedErrors(new Set());
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const isBusy = modalState === 'parsing' || downloadingTemplate;

  const handleClose = () => {
    if (isBusy) { onClose(); return; }  // cerrar sin resetear si hay trabajo en curso
    reset();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    onDownloadingChange?.(true);
    setDownloadProgress(4);
    setDownloadLabel('Descargando datos...');

    // Progreso animado mientras esperan las APIs (avanza lentamente hasta ~82%)
    let fakeProgress = 4;
    const ticker = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + Math.random() * 2.5 + 0.5, 82);
      setDownloadProgress(Math.round(fakeProgress));
    }, 500);

    try {
      const [products, customers] = await Promise.all([getAllProducts(), getAllCustomers()]);

      clearInterval(ticker);
      setDownloadProgress(88);
      setDownloadLabel('Generando archivo Excel...');
      await buildAndDownloadTemplate(laboratories, products, customers);

      setDownloadProgress(100);
      toast.success('Plantilla descargada');
    } catch (err) {
      clearInterval(ticker);
      toast.error('Error al generar la plantilla');
      console.error(err);
    } finally {
      setDownloadingTemplate(false);
      onDownloadingChange?.(false);
      setDownloadProgress(0);
      setDownloadLabel('');
    }
  };

  const processFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Solo se permiten archivos .xlsx o .xls');
      return;
    }
    setModalState('parsing');
    onBusyChange?.(true);
    try {
      const [parsedRows, products, customers] = await Promise.all([
        parseFile(file),
        getAllProducts(),
        getAllCustomers(),
      ]);
      const productMap = buildProductMap(products);
      const customerMap = buildCustomerMap(customers);
      const validated = validateAndGroup(parsedRows, laboratories, productMap, customerMap);
      setGroups(validated);
      setFileName(file.name);
      setModalState('preview');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al leer el archivo');
      setModalState('idle');
    } finally {
      onBusyChange?.(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    const validGroups = groups.filter((g) => g.isValid);
    if (validGroups.length === 0) return;
    const rows = validGroups.flatMap((g) => g.rows);
    setImporting(true);
    setModalState('importing');
    try {
      const res = await importPromotions(rows);
      setResult(res);
      setModalState('result');
      if (res.imported_count > 0) onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar');
      setModalState('preview');
    } finally {
      setImporting(false);
    }
  };

  const toggleGroupErrors = (key: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const validCount = groups.filter((g) => g.isValid).length;
  const invalidCount = groups.filter((g) => !g.isValid).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <style>{`@keyframes promo-stripes { from { background-position: 28px 0; } to { background-position: 0 0; } }`}</style>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-foreground">Importar Promociones desde Excel</DialogTitle>
        </DialogHeader>

        {/* ── idle ── */}
        {modalState === 'idle' && (
          <div className="space-y-4">
            <div
              className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${isBusy ? 'cursor-not-allowed border-muted-foreground/35 bg-muted/35 shadow-[inset_0_0_0_1px_hsl(var(--border))]' : isDragging ? 'cursor-pointer border-primary bg-green-50 scale-[1.01]' : 'cursor-pointer border-primary/40 hover:border-primary hover:bg-green-50/60'}`}
              onClick={() => { if (!isBusy) fileInputRef.current?.click(); }}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); if (!isBusy) setIsDragging(true); }}
              onDragLeave={() => { if (!isBusy) setIsDragging(false); }}
            >
              <Upload className={`size-8 transition-colors ${isBusy ? 'text-muted-foreground/45' : isDragging ? 'text-primary' : 'text-primary/50'}`} />
              <div>
                <p className={`text-sm font-medium ${isBusy ? 'text-muted-foreground' : 'text-foreground/80'}`}>Arrastra tu archivo aqui</p>
                <p className="text-xs text-muted-foreground">o haz clic para seleccionar &nbsp;·&nbsp; Solo archivos .xlsx</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />

            {downloadingTemplate ? (
              <div className="space-y-2.5 rounded-lg border border-green-200 bg-green-50/60 px-4 py-3 dark:border-green-800/30 dark:bg-green-950/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-green-800 dark:text-green-400">
                    <Loader2 className="size-3.5 animate-spin" />
                    {downloadLabel}
                  </span>
                  <span className="tabular-nums font-semibold text-green-700 dark:text-green-400">{downloadProgress}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-green-100 dark:bg-green-900/30">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${downloadProgress}%`,
                      backgroundImage: 'repeating-linear-gradient(45deg, #1a5c38 0px, #1a5c38 10px, #2d8653 10px, #2d8653 20px)',
                      backgroundSize: '28px 28px',
                      animation: 'promo-stripes 0.5s linear infinite',
                    }}
                  />
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleDownloadTemplate}
              >
                <Download className="size-4" /> Descargar plantilla
              </Button>
            )}

          </div>
        )}

        {/* ── parsing ── */}
        {modalState === 'parsing' && (
          <div className="py-4">
            <StepsProgress
              steps={PARSING_STEPS}
              step={parsingStep}
              progress={parsingProgress}
              label={PARSING_STEPS[parsingStep]}
            />
          </div>
        )}

        {/* ── preview ── */}
        {modalState === 'preview' && (
          <div className="flex flex-col gap-3">

            {/* Archivo + resumen */}
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
              <FileSpreadsheet className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{fileName}</p>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  {validCount > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <Tag className="size-3 text-muted-foreground" />{validCount} promocion{validCount !== 1 ? 'es' : ''}
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
                      <AlertCircle className="size-3" />{invalidCount} con error
                    </span>
                  )}
                </div>
              </div>
              <button type="button" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={reset}>
                <X className="size-4" />
              </button>
            </div>

            {/* Lista de campañas */}
            <div className="max-h-[55vh] space-y-2 overflow-y-auto">
              {groups.map((g) => (
                <div
                  key={g.key}
                  className="rounded-lg border border-border bg-muted/30"
                >
                  {/* Cabecera de la campaña */}
                  <div className="flex items-start gap-2.5 px-3 pt-3">
                    {g.isValid
                      ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      : <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight text-foreground">{g.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/70">{g.labName}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/70">{displayDate(g.startDate)} – {displayDate(g.endDate)}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/70">{g.mechanicSummary}</span>
                      </div>
                    </div>
                    {!g.isValid && (
                      <button type="button" className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground" onClick={() => toggleGroupErrors(g.key)}>
                        {expandedErrors.has(g.key) ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </button>
                    )}
                  </div>

                  {/* Productos */}
                  <div className="mt-2.5 border-t px-3 py-2">
                    <div className="flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-foreground">Productos</span>
                      <div className="flex min-w-0 flex-wrap gap-1">
                        {g.productNames.length === 0
                          ? <span className="text-xs italic text-muted-foreground">sin productos</span>
                          : <>
                              {g.productNames.slice(0, 3).map((name, i) => (
                                <span key={i} className="truncate rounded-full bg-muted px-2 py-0.5 text-[11px] max-w-[140px] text-foreground/80 sm:max-w-[200px]">{name}</span>
                              ))}
                              {g.productNames.length > 3 && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/70">
                                  +{g.productNames.length - 3} más
                                </span>
                              )}
                            </>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Alcance */}
                  <div className="border-t px-3 pb-3 pt-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-foreground">Alcance</span>
                      {g.scopeLabel === 'Clientes especificos' ? (
                        <>
                          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/70">
                            <Users className="size-3 text-muted-foreground" /> {g.scopeLabel}
                          </span>
                          {g.customerNames.length > 0 && (
                            <>
                              {g.customerNames.slice(0, 2).map((name, i) => (
                                <span key={i} className="truncate rounded-full bg-muted px-2 py-0.5 text-[11px] max-w-[130px] text-foreground/80 sm:max-w-[180px]">{name}</span>
                              ))}
                              {g.customerNames.length > 2 && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/70">
                                  +{g.customerNames.length - 2} más
                                </span>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/70">
                          <Globe className="size-3 text-muted-foreground" /> {g.scopeLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Errores */}
                  {!g.isValid && expandedErrors.has(g.key) && (
                    <ul className="border-t px-3 py-2 space-y-0.5">
                      {g.errors.map((err, i) => (
                        <li key={`${g.key}-err-${i}`} className="text-xs text-red-600 dark:text-red-400">• {err}</li>
                      ))}
                    </ul>
                  )}
                  {!g.isValid && !expandedErrors.has(g.key) && g.errors.length > 0 && (
                    <div className="border-t px-3 py-2">
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {g.errors[0]}{g.errors.length > 1 ? ` (+${g.errors.length - 1} más)` : ''}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <Button
                className="w-full gap-2 sm:flex-1"
                onClick={handleImport}
                disabled={validCount === 0 || importing}
              >
                <CheckCheck className="size-4" />
                {importing
                  ? 'Importando...'
                  : validCount > 0
                    ? `Importar ${validCount} campaña${validCount !== 1 ? 's' : ''}`
                    : 'Sin campañas válidas'}
              </Button>
            </div>
          </div>
        )}

        {/* ── importing ── */}
        {modalState === 'importing' && (
          <div className="py-4">
            <StepsProgress
              steps={IMPORTING_STEPS}
              step={importingStep}
              progress={importingProgress}
              label={IMPORTING_STEPS[importingStep]}
            />
          </div>
        )}

        {/* ── result ── */}
        {modalState === 'result' && result && (
          <div className="py-2 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Importación completada</p>
                <p className="text-xs text-muted-foreground">Las campañas del Excel han sido procesadas correctamente</p>
              </div>
            </div>

            {/* Stats */}
            <div className="rounded-lg border divide-y">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                    <FileSpreadsheet className="size-3.5 text-primary" />
                  </span>
                  <span className="text-sm">Campañas importadas</span>
                </div>
                <span className="text-sm font-semibold tabular-nums">{result.imported_count}</span>
              </div>
              {result.skipped_count > 0 && (
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-md bg-muted">
                      <AlertCircle className="size-3.5 text-muted-foreground" />
                    </span>
                    <span className="text-sm text-muted-foreground">Omitidas por el servidor</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">{result.skipped_count}</span>
                </div>
              )}
            </div>

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2.5 text-sm"
                  onClick={() => setErrorsExpanded((v) => !v)}
                >
                  <span className="flex items-center gap-2 font-medium text-destructive">
                    <AlertCircle className="size-4" />
                    {result.errors.length} {result.errors.length === 1 ? 'error en la importación' : 'errores en la importación'}
                  </span>
                  {errorsExpanded ? <ChevronUp className="size-4 text-destructive" /> : <ChevronDown className="size-4 text-destructive" />}
                </button>
                {errorsExpanded && (
                  <ul className="max-h-40 overflow-y-auto border-t px-4 py-2 space-y-1 text-xs text-destructive">
                    {result.errors.map((err, i) => (
                      <li key={`server-err-${i}`} className="py-0.5">• {err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Button variant="outline" onClick={handleClose}>Cerrar</Button>
              <Button onClick={reset} className="gap-2">
                <Upload className="size-3.5" /> Importar otro
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
