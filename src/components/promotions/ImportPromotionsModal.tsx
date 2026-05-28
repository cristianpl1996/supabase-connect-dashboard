import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
  Upload, Download, FileSpreadsheet, X,
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

interface ImportPromotionsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onDownloadingChange?: (downloading: boolean) => void;
  laboratories: Laboratory[];
}

type ModalState = 'idle' | 'parsing' | 'preview' | 'importing' | 'result';

interface CampaignGroup {
  key: string;
  labName: string;
  title: string;
  startDate: string;
  endDate: string;
  skus: string[];
  tipoMecanica: string;
  mechanicSummary: string;
  scopeLabel: string;
  customerIds: string[];
  rows: PromotionImportRowPayload[];
  errors: string[];
  isValid: boolean;
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
const VALID_ORIGINS = ['dinamica comercial', 'recurso propio'];
const SCOPE_CUSTOMERS_VALUES = ['clientes especificos', 'clientes_especificos', 'customers', 'especificos'];

function resolveScope(alcance: string | null | undefined): 'all' | 'customers' {
  return SCOPE_CUSTOMERS_VALUES.includes((alcance ?? '').trim().toLowerCase()) ? 'customers' : 'all';
}

function validateAndGroup(rows: PromotionImportRowPayload[], laboratories: Laboratory[]): CampaignGroup[] {
  const labNamesLower = new Set(laboratories.map((l) => l.name.trim().toLowerCase()));
  const rowErrors: Map<number, string[]> = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errs: string[] = [];
    const n = i + 2;

    if (!row.laboratory?.trim()) errs.push(`Fila ${n}: Laboratorio requerido`);
    else if (!labNamesLower.has(row.laboratory.trim().toLowerCase()))
      errs.push(`Fila ${n}: Laboratorio "${row.laboratory.trim()}" no encontrado en el sistema`);

    if (!row.title?.trim()) errs.push(`Fila ${n}: Titulo requerido`);
    if (!row.sku?.trim()) errs.push(`Fila ${n}: SKU requerido`);

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

    if (row.origin && !VALID_ORIGINS.includes(row.origin.trim().toLowerCase()))
      errs.push(`Fila ${n}: Origen debe ser "Dinamica comercial" o "Recurso propio"`);

    const alcanceRaw = (row.alcance ?? '').trim().toLowerCase();
    if (alcanceRaw && resolveScope(row.alcance) === 'all' && !['toda la base', 'all', 'todos', ''].includes(alcanceRaw))
      errs.push(`Fila ${n}: Alcance debe ser "Toda la base" o "Clientes especificos"`);

    if (resolveScope(row.alcance) === 'customers' && !(row.clientes ?? '').trim())
      errs.push(`Fila ${n}: Columna Clientes requerida cuando Alcance = "Clientes especificos"`);

    rowErrors.set(i, errs);
  }

  const groupMap = new Map<string, { rows: PromotionImportRowPayload[]; indices: number[] }>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = [
      (row.laboratory ?? '').trim().toLowerCase(),
      (row.title ?? '').trim(),
      row.start_date ?? '',
      row.end_date ?? '',
    ].join('||');
    if (!groupMap.has(key)) groupMap.set(key, { rows: [], indices: [] });
    groupMap.get(key)!.rows.push(row);
    groupMap.get(key)!.indices.push(i);
  }

  const groups: CampaignGroup[] = [];

  for (const [key, { rows: gRows, indices }] of groupMap.entries()) {
    const allErrors: string[] = [];
    for (const idx of indices) allErrors.push(...(rowErrors.get(idx) ?? []));

    const mecanicas = new Set(gRows.map((r) => (r.tipo_mecanica ?? '').trim().toLowerCase()).filter(Boolean));
    if (mecanicas.size > 1)
      allErrors.push(`Campana: mecanicas mezcladas (${[...mecanicas].join(', ')})`);

    const scopes = new Set(gRows.map((r) => resolveScope(r.alcance)));
    if (scopes.size > 1)
      allErrors.push('Campana: alcances mezclados en el mismo grupo');

    const first = gRows[0];
    const mecanica = (first.tipo_mecanica ?? '').trim().toLowerCase();
    let mechanicSummary = mecanica;
    if (mecanica === 'bonificacion' && first.base_cantidad && first.bonus_cantidad)
      mechanicSummary = `Bonificacion ${first.base_cantidad}+${first.bonus_cantidad}`;
    else if (mecanica === 'bonificacion') mechanicSummary = 'Bonificacion';
    else if (mecanica === 'descuento' && first.porcentaje_descuento != null)
      mechanicSummary = `Descuento ${first.porcentaje_descuento}%`;
    else if (mecanica === 'descuento') mechanicSummary = 'Descuento';

    const scope = resolveScope(first.alcance);
    const scopeLabel = scope === 'customers' ? 'Clientes especificos' : 'Toda la base';
    const customerIds = scope === 'customers'
      ? (first.clientes ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    groups.push({
      key,
      labName: first.laboratory?.trim() ?? '',
      title: first.title?.trim() ?? '',
      startDate: first.start_date ?? '',
      endDate: first.end_date ?? '',
      skus: gRows.map((r) => r.sku?.trim()).filter(Boolean),
      tipoMecanica: mecanica,
      mechanicSummary,
      scopeLabel,
      customerIds,
      rows: gRows,
      errors: [...new Set(allErrors)],
      isValid: allErrors.length === 0,
    });
  }

  return groups;
}

// ─── Template download (with real data) ──────────────────────────────────────

async function buildAndDownloadTemplate(
  laboratories: Laboratory[],
  products: ProductCatalogItem[],
  customers: CustomerRecord[],
) {
  const labNames = laboratories.map((l) => l.name.trim()).filter(Boolean);
  const skuRows = products
    .filter((p) => p.product_sku)
    .map((p) => [p.product_sku, p.product_commercial_name ?? '', p.product_brand_name ?? ''] as const);
  const custRows = customers
    .map((c) => [
      String(c['id'] ?? c['customer_id'] ?? ''),
      String(c['customer_full_name'] ?? c['customer_commercial_name'] ?? c['customer_name'] ?? ''),
      String(c['customer_government_id'] ?? ''),
    ] as const)
    .filter((r) => r[0]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IVANagro';

  // Colores marca Ivanagro
  const GREEN_DARK  = 'FF1A5C38'; // header principal
  const GREEN_MID   = 'FF2D8653'; // header secundario / instrucciones
  const GREEN_LIGHT = 'FFD6F0E0'; // zebra par
  const GREEN_PALE  = 'FFEDF8F1'; // zebra impar

  // ── Sheet 1: Promociones (activa al abrir) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsMain = wb.addWorksheet('Promociones') as any;
  wsMain.columns = [
    { header: 'Laboratorio', key: 'lab', width: 30 },
    { header: 'Titulo', key: 'titulo', width: 34 },
    { header: 'Origen', key: 'origen', width: 24 },
    { header: 'Fecha_Inicio', key: 'fi', width: 14 },
    { header: 'Fecha_Fin', key: 'ff', width: 14 },
    { header: 'SKU', key: 'sku', width: 18 },
    { header: 'Tipo_Mecanica', key: 'mecanica', width: 18 },
    { header: 'Base_Cantidad', key: 'base', width: 15 },
    { header: 'Bonus_Cantidad', key: 'bonus', width: 16 },
    { header: 'Porcentaje_Descuento', key: 'pct', width: 22 },
    { header: 'Alcance', key: 'alcance', width: 24 },
    { header: 'Clientes', key: 'clientes', width: 40 },
  ];

  // Fila de encabezados — verde Ivanagro oscuro
  const headerRow = wsMain.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_DARK } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF0F3D26' } } };
  });
  headerRow.height = 22;
  wsMain.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]; // congelar encabezado

  // Filas de ejemplo
  const today = todayStr();
  const nextMonth = nextMonthStr();
  const ex1Lab = labNames[0] ?? 'Nombre del Laboratorio';
  const ex1Sku1 = skuRows[0]?.[0] ?? 'SKU-001';
  const ex1Sku2 = skuRows[1]?.[0] ?? 'SKU-002';
  const ex2Sku = skuRows[2]?.[0] ?? 'SKU-003';
  const exCustIds = custRows.slice(0, 3).map((r) => r[0]).join(', ') || '100001, 100002';

  wsMain.addRow([ex1Lab, 'BONIFICADO 10+1 JUNIO', 'Dinamica comercial', today, nextMonth, ex1Sku1, 'bonificacion', 10, 1, '', 'Toda la base', '']);
  wsMain.addRow([ex1Lab, 'BONIFICADO 10+1 JUNIO', 'Dinamica comercial', today, nextMonth, ex1Sku2, 'bonificacion', 10, 1, '', 'Toda la base', '']);
  wsMain.addRow([ex1Lab, 'DESCUENTO 3% CLIENTES VIP', 'Recurso propio', today, nextMonth, ex2Sku, 'descuento', '', '', 3, 'Clientes especificos', exCustIds]);

  // Zebra stripes verdes en filas de ejemplo
  for (let r = 2; r <= 4; r++) {
    wsMain.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 === 0 ? GREEN_LIGHT : GREEN_PALE } };
      cell.font = { name: 'Calibri', size: 10 };
    });
  }

  // ── Dropdowns (data validations) ──
  const labEnd = labNames.length + 1;
  const skuEnd = skuRows.length + 1;

  // Col A — Laboratorio
  wsMain.dataValidations.add('A2:A10000', {
    type: 'list', allowBlank: true,
    formulae: [`Referencia!$A$2:$A$${labEnd}`],
    showErrorMessage: true, errorStyle: 'error',
    errorTitle: 'Laboratorio invalido',
    error: 'Selecciona un laboratorio de la lista',
  });

  // Col C — Origen
  wsMain.dataValidations.add('C2:C10000', {
    type: 'list', allowBlank: true,
    formulae: ['"Dinamica comercial,Recurso propio"'],
    showErrorMessage: true, errorStyle: 'warning',
    errorTitle: 'Origen invalido',
    error: 'Debe ser "Dinamica comercial" o "Recurso propio"',
  });

  // Col F — SKU
  wsMain.dataValidations.add('F2:F10000', {
    type: 'list', allowBlank: true,
    formulae: [`Referencia!$B$2:$B$${skuEnd}`],
    showErrorMessage: true, errorStyle: 'error',
    errorTitle: 'SKU invalido',
    error: 'Selecciona un SKU de la lista',
  });

  // Col G — Tipo_Mecanica
  wsMain.dataValidations.add('G2:G10000', {
    type: 'list', allowBlank: true,
    formulae: ['"bonificacion,descuento"'],
    showErrorMessage: true, errorStyle: 'error',
    errorTitle: 'Mecanica invalida',
    error: 'Debe ser "bonificacion" o "descuento"',
  });

  // Col K — Alcance
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
    ['COLUMNAS DEL ARCHIVO', null, null, null],
    ['Columna', 'Descripcion', 'Valores validos', 'Requerido'],
    ['Laboratorio', 'Nombre exacto del lab. Usar el dropdown.', 'Ver desplegable', 'Si'],
    ['Titulo', 'Nombre de la campana. Mismo titulo + lab + fechas = 1 campana con varios SKUs.', 'Texto libre', 'Si'],
    ['Origen', 'Origen comercial de la promocion.', 'Dinamica comercial | Recurso propio', 'No'],
    ['Fecha_Inicio', 'Fecha de inicio de vigencia.', 'DD/MM/YYYY', 'Si'],
    ['Fecha_Fin', 'Fecha de fin de vigencia.', 'DD/MM/YYYY', 'Si'],
    ['SKU', 'Codigo del producto. Usar el dropdown.', 'Ver desplegable', 'Si'],
    ['Tipo_Mecanica', 'Tipo de beneficio.', 'bonificacion | descuento', 'Si'],
    ['Base_Cantidad', 'Cantidad a comprar. Ej: 10 para escala 10+1.', 'Entero >= 1', 'Si (solo bonificacion)'],
    ['Bonus_Cantidad', 'Cantidad bonificada. Ej: 1 para 10+1.', 'Entero >= 1', 'Si (solo bonificacion)'],
    ['Porcentaje_Descuento', 'Descuento sobre el precio. Ej: 3 para 3%.', '0 a 100', 'Si (solo descuento)'],
    ['Alcance', 'A quienes aplica.', 'Toda la base | Clientes especificos', 'No (default: Toda la base)'],
    ['Clientes', 'IDs de clientes separados por coma.', 'Ej: 123456, 789012', 'Si (si Alcance = Clientes especificos)'],
    [null, null, null, null],
    ['REGLA DE AGRUPACION', null, null, null],
    ['Filas con mismo Laboratorio + Titulo + Fecha_Inicio + Fecha_Fin = UNA campana con multiples SKUs.', null, null, null],
    [`Datos cargados: ${labNames.length} laboratorios, ${skuRows.length} SKUs, ${custRows.length} clientes.`, null, null, null],
  ];
  for (const row of instrRows) wsInstr.addRow(row);

  const instrTitle = wsInstr.getCell('A1');
  instrTitle.font = { bold: true, size: 14, color: { argb: GREEN_DARK }, name: 'Calibri' };

  const instrHeaderRow = wsInstr.getRow(4);
  instrHeaderRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_MID } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle' };
  });
  instrHeaderRow.height = 18;

  wsInstr.getRow(3).font = { bold: true, size: 11, color: { argb: GREEN_DARK } };
  wsInstr.getRow(18).font = { bold: true, size: 11, color: { argb: GREEN_DARK } };

  // ── Sheet 3: Referencia (datos del sistema para los dropdowns) ──
  const wsRef = wb.addWorksheet('Referencia');
  wsRef.columns = [
    { header: 'Laboratorio', width: 32 },
    { header: 'SKU', width: 18 },
    { header: 'Nombre Producto', width: 44 },
    { header: 'Marca', width: 24 },
    { header: 'ID Cliente', width: 14 },
    { header: 'Nombre Cliente', width: 44 },
    { header: 'NIT / Cedula', width: 20 },
  ];
  // Estilo encabezado Referencia
  wsRef.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_MID } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  wsRef.getRow(1).height = 18;
  const maxRef = Math.max(labNames.length, skuRows.length, custRows.length);
  for (let i = 0; i < maxRef; i++) {
    wsRef.addRow([
      labNames[i] ?? '',
      skuRows[i]?.[0] ?? '',
      skuRows[i]?.[1] ?? '',
      skuRows[i]?.[2] ?? '',
      custRows[i]?.[0] ?? '',
      custRows[i]?.[1] ?? '',
      custRows[i]?.[2] ?? '',
    ]);
  }

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

function parseFile(file: File): Promise<PromotionImportRowPayload[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array', cellDates: false });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        if (jsonData.length === 0) return reject(new Error('El archivo esta vacio'));

        const rows: PromotionImportRowPayload[] = jsonData.map((row) => ({
          laboratory: String(row['Laboratorio'] ?? '').trim(),
          title: String(row['Titulo'] ?? '').trim(),
          origin: row['Origen'] ? String(row['Origen']).trim() : null,
          start_date: formatExcelDate(row['Fecha_Inicio']),
          end_date: formatExcelDate(row['Fecha_Fin']),
          sku: String(row['SKU'] ?? '').trim(),
          tipo_mecanica: String(row['Tipo_Mecanica'] ?? '').trim().toLowerCase(),
          base_cantidad: row['Base_Cantidad'] != null && String(row['Base_Cantidad']).trim() !== '' ? Number(row['Base_Cantidad']) : null,
          bonus_cantidad: row['Bonus_Cantidad'] != null && String(row['Bonus_Cantidad']).trim() !== '' ? Number(row['Bonus_Cantidad']) : null,
          porcentaje_descuento: row['Porcentaje_Descuento'] != null && String(row['Porcentaje_Descuento']).trim() !== '' ? Number(row['Porcentaje_Descuento']) : null,
          alcance: row['Alcance'] ? String(row['Alcance']).trim() : null,
          clientes: row['Clientes'] ? String(row['Clientes']).trim() : null,
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

export function ImportPromotionsModal({ open, onClose, onSuccess, onDownloadingChange, laboratories }: ImportPromotionsModalProps) {
  const [modalState, setModalState] = useState<ModalState>('idle');
  const [groups, setGroups] = useState<CampaignGroup[]>([]);
  const [fileName, setFileName] = useState('');
  const [totalRows, setTotalRows] = useState(0);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadLabel, setDownloadLabel] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setModalState('idle');
    setGroups([]);
    setFileName('');
    setTotalRows(0);
    setResult(null);
    setErrorsExpanded(false);
    setExpandedErrors(new Set());
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => { reset(); onClose(); };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    onDownloadingChange?.(true);
    setDownloadProgress(2);
    setDownloadLabel('Descargando datos...');
    try {
      const [products, customers] = await Promise.all([getAllProducts(), getAllCustomers()]);

      setDownloadProgress(88);
      setDownloadLabel('Generando archivo Excel...');
      await buildAndDownloadTemplate(laboratories, products, customers);

      setDownloadProgress(100);
      toast.success('Plantilla descargada');
    } catch (err) {
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
    try {
      const rows = await parseFile(file);
      const validated = validateAndGroup(rows, laboratories);
      setGroups(validated);
      setFileName(file.name);
      setTotalRows(rows.length);
      setModalState('preview');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al leer el archivo');
      setModalState('idle');
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
      <style>{`
        @keyframes ivanagro-stripes {
          from { background-position: 28px 0; }
          to   { background-position: 0 0; }
        }
        .progress-striped {
          background-image: repeating-linear-gradient(
            45deg,
            #1a5c38 0px, #1a5c38 10px,
            #2d8653 10px, #2d8653 20px
          );
          background-size: 28px 28px;
          animation: ivanagro-stripes 0.5s linear infinite;
        }
      `}</style>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Promociones desde Excel</DialogTitle>
        </DialogHeader>

        {/* ── idle ── */}
        {modalState === 'idle' && (
          <div className="space-y-4">
            <div
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${isDragging ? 'border-primary bg-green-50 scale-[1.01]' : 'border-primary/40 hover:border-primary hover:bg-green-50/60'}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
            >
              <Upload className={`size-8 transition-colors ${isDragging ? 'text-primary' : 'text-primary/50'}`} />
              <div>
                <p className="text-sm font-medium text-foreground/80">Arrastra tu archivo aqui</p>
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
                    className="progress-striped h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${downloadProgress}%` }}
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
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Analizando archivo y validando datos...</p>
          </div>
        )}

        {/* ── preview ── */}
        {modalState === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
              <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {totalRows} {totalRows === 1 ? 'fila' : 'filas'}&nbsp;·&nbsp;{groups.length} {groups.length === 1 ? 'campana' : 'campanas'}
                </p>
              </div>
              <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={reset}>
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {validCount > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
                  <CheckCircle2 className="size-3.5" />
                  {validCount} {validCount === 1 ? 'campana lista' : 'campanas listas'}
                </span>
              )}
              {invalidCount > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
                  <AlertCircle className="size-3.5" />
                  {invalidCount} {invalidCount === 1 ? 'campana con error' : 'campanas con error'} (se omitira{invalidCount > 1 ? 'n' : ''})
                </span>
              )}
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {groups.map((g) => (
                <div
                  key={g.key}
                  className={`rounded-lg border px-4 py-3 ${g.isValid ? 'border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-950/10' : 'border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/10'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      {g.isValid
                        ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                        : <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{g.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.labName}&nbsp;·&nbsp;{displayDate(g.startDate)} – {displayDate(g.endDate)}&nbsp;·&nbsp;{g.mechanicSummary}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <p className="text-xs text-muted-foreground">SKUs: {g.skus.join(', ')}</p>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {g.scopeLabel === 'Clientes especificos'
                              ? <><Users className="size-3" /> {g.scopeLabel}{g.customerIds.length > 0 ? ` (${g.customerIds.length})` : ''}</>
                              : <><Globe className="size-3" /> {g.scopeLabel}</>}
                          </span>
                        </div>
                        {g.scopeLabel === 'Clientes especificos' && g.customerIds.length > 0 && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            IDs: {g.customerIds.slice(0, 5).join(', ')}{g.customerIds.length > 5 ? ` +${g.customerIds.length - 5} mas` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    {!g.isValid && (
                      <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => toggleGroupErrors(g.key)}>
                        {expandedErrors.has(g.key) ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </button>
                    )}
                  </div>
                  {!g.isValid && expandedErrors.has(g.key) && (
                    <ul className="mt-2 space-y-0.5 border-t border-red-200 pt-2 dark:border-red-800/40">
                      {g.errors.map((err, i) => (
                        <li key={i} className="text-xs text-red-600 dark:text-red-400">• {err}</li>
                      ))}
                    </ul>
                  )}
                  {!g.isValid && !expandedErrors.has(g.key) && g.errors.length > 0 && (
                    <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                      {g.errors[0]}{g.errors.length > 1 ? ` (+${g.errors.length - 1} mas)` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={reset}>Cambiar archivo</Button>
              <Button className="flex-1 gap-2" onClick={handleImport} disabled={validCount === 0 || importing}>
                <CheckCheck className="size-4" />
                Importar {validCount > 0 ? `${validCount} campana${validCount !== 1 ? 's' : ''} valida${validCount !== 1 ? 's' : ''}` : ''}
              </Button>
            </div>
          </div>
        )}

        {/* ── importing ── */}
        {modalState === 'importing' && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importando {validCount} {validCount === 1 ? 'campana' : 'campanas'}...</p>
          </div>
        )}

        {/* ── result ── */}
        {modalState === 'result' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-green-50 px-4 py-3 dark:bg-green-950/20">
              <CheckCircle2 className="size-5 shrink-0 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  {result.imported_count} {result.imported_count === 1 ? 'campana importada' : 'campanas importadas'} correctamente
                </p>
                {result.skipped_count > 0 && (
                  <p className="text-xs text-muted-foreground">{result.skipped_count} filas omitidas por el servidor</p>
                )}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5">
                <button
                  className="flex w-full items-center justify-between px-4 py-2.5 text-sm"
                  onClick={() => setErrorsExpanded((v) => !v)}
                >
                  <span className="flex items-center gap-2 font-medium text-destructive">
                    <AlertCircle className="size-4" />
                    {result.errors.length} {result.errors.length === 1 ? 'error del servidor' : 'errores del servidor'}
                  </span>
                  {errorsExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {errorsExpanded && (
                  <ul className="max-h-40 overflow-y-auto border-t px-4 py-2 text-xs text-destructive">
                    {result.errors.map((err, i) => (
                      <li key={i} className="py-0.5">• {err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>Importar otro</Button>
              <Button className="flex-1" onClick={handleClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
