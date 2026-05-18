import { useState, useCallback } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContractDropzoneProps {
  onFileAnalyzed: (result: {
    brand_name: string;
    year: number;
    annual_goal: number;
    invoice_discount_perc: number;
    rebate_sell_in_perc: number;
    rebate_sell_out_perc: number;
    marketing_perc: number;
    marketing_fixed_value: number;
    financial_discount_perc: number;
    total_margin_perc: number;
    funds: Array<{
      concept_key: 'Desc_Pie_Factura' | 'Rebate_SellIn' | 'Rebate_SellOut' | 'Marketing' | 'Pronto_Pago' | 'Otro';
      custom_concept?: string;
      type: 'percentage' | 'fixed';
      value: number;
    }>;
  }) => void;
  disabled?: boolean;
}

type DropzoneState = 'idle' | 'dragover' | 'analyzing' | 'success' | 'error';

export function ContractDropzone({ onFileAnalyzed, disabled }: ContractDropzoneProps) {
  const [state, setState] = useState<DropzoneState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.includes('pdf')) {
      setState('error');
      setErrorMessage('Solo se aceptan archivos PDF');
      return;
    }

    setFileName(file.name);
    setState('analyzing');
    setErrorMessage('');

    try {
      const { analyzeContract } = await import('@/services/aiPlanParser');
      const result = await analyzeContract(file);
      setState('success');
      onFileAnalyzed(result);
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Error al analizar el contrato');
    }
  }, [onFileAnalyzed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile, disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setState('dragover');
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setState('idle');
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const resetDropzone = useCallback(() => {
    setState('idle');
    setFileName('');
    setErrorMessage('');
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'relative rounded-lg border-2 border-dashed p-6 transition-all duration-200',
        state === 'idle' && 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
        state === 'dragover' && 'border-primary bg-primary/10',
        state === 'analyzing' && 'border-amber-500 bg-amber-500/10',
        state === 'success' && 'border-green-500 bg-green-500/10',
        state === 'error' && 'border-destructive bg-destructive/10',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <input
        type="file"
        accept="application/pdf"
        onChange={handleInputChange}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        disabled={disabled || state === 'analyzing'}
      />

      <div className="pointer-events-none flex flex-col items-center gap-2 text-center">
        {state === 'idle' && (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Arrastra tu contrato PDF aqui</p>
            <p className="text-xs text-muted-foreground">o haz clic para seleccionar un archivo</p>
          </>
        )}

        {state === 'dragover' && (
          <>
            <Upload className="h-8 w-8 animate-bounce text-primary" />
            <p className="text-sm font-medium text-primary">Suelta el archivo aqui</p>
          </>
        )}

        {state === 'analyzing' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            <p className="text-sm font-medium text-amber-700">Analizando el archivo PDF...</p>
            <p className="text-xs text-amber-600">{fileName}</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <p className="text-sm font-medium text-green-700">Contrato analizado</p>
            <p className="text-xs text-green-600">{fileName} - Revisa los datos abajo</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetDropzone();
              }}
              className="pointer-events-auto mt-1 text-xs text-muted-foreground underline hover:text-foreground"
            >
              Subir otro archivo
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">Error al analizar</p>
            <p className="text-xs text-destructive/80">{errorMessage}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetDropzone();
              }}
              className="pointer-events-auto mt-1 text-xs text-muted-foreground underline hover:text-foreground"
            >
              Intentar de nuevo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
