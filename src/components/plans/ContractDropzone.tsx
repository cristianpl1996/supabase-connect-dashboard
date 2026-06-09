import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { createPlanExtraction, uploadPlanContract } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ContractDropzoneProps {
  labId: string;
  parentPlanId?: string | null;
  disabled?: boolean;
}

type DropzoneState = 'idle' | 'dragover' | 'analyzing' | 'success' | 'error';

/**
 * Zona "Análisis Inteligente": sube el PDF al backend, dispara la extracción IA
 * (crea un plan borrador en pending_review) y navega a la pantalla de revisión.
 */
export function ContractDropzone({ labId, parentPlanId, disabled }: ContractDropzoneProps) {
  const navigate = useNavigate();
  const [state, setState] = useState<DropzoneState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.includes('pdf')) {
      setState('error');
      setErrorMessage('Solo se aceptan archivos PDF');
      return;
    }
    if (!labId) {
      setState('error');
      setErrorMessage('Selecciona primero el laboratorio');
      return;
    }

    setFileName(file.name);
    setState('analyzing');
    setErrorMessage('');

    try {
      const { url } = await uploadPlanContract(file);
      const plan = await createPlanExtraction({
        contract_pdf_url: url,
        lab_id: labId,
        parent_plan_id: parentPlanId ?? null,
      });
      if (plan.extraction_status === 'rejected') {
        setState('error');
        setErrorMessage('La IA no pudo extraer un JSON válido del documento. Revisa el plan creado o reintenta.');
        return;
      }
      setState('success');
      navigate(`/plans/${plan.id}/review`);
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Error al analizar el contrato');
    }
  }, [labId, parentPlanId, navigate]);

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
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        disabled={disabled || state === 'analyzing'}
      />

      <div className="pointer-events-none flex flex-col items-center gap-2 text-center">
        {state === 'idle' && (
          <>
            <Upload className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Arrastra tu contrato PDF aqui</p>
            <p className="text-xs text-muted-foreground">
              {labId
                ? 'La IA extraerá fondos, escalas, períodos y condiciones para tu revisión'
                : 'Selecciona primero el laboratorio para habilitar el análisis'}
            </p>
          </>
        )}

        {state === 'dragover' && (
          <>
            <Upload className="size-8 transition-transform duration-300 hover:-translate-y-1 text-primary" />
            <p className="text-sm font-medium text-primary">Suelta el archivo aqui</p>
          </>
        )}

        {state === 'analyzing' && (
          <>
            <Loader2 className="size-8 animate-spin text-amber-600" />
            <p className="text-sm font-medium text-amber-700">Analizando el contrato con IA…</p>
            <p className="text-xs text-amber-600">{fileName}</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="size-8 text-green-600" />
            <p className="text-sm font-medium text-green-700">Contrato analizado</p>
            <p className="text-xs text-green-600">{fileName} - Abriendo la pantalla de revisión…</p>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircle className="size-8 text-destructive" />
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
