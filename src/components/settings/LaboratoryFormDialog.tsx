import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Laboratory, LaboratoryFormData } from '@/hooks/useLaboratories';

interface LaboratoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  laboratory?: Laboratory | null;
  onSubmit: (data: LaboratoryFormData) => Promise<void>;
}

export function LaboratoryFormDialog({
  open,
  onOpenChange,
  laboratory,
  onSubmit,
}: LaboratoryFormDialogProps) {
  const [name, setName] = useState('');
  const [erpCode, setErpCode] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#16a34a');
  const [annualGoal, setAnnualGoal] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!laboratory;

  useEffect(() => {
    if (open) {
      if (laboratory) {
        setName(laboratory.name);
        setErpCode(laboratory.erp_code || '');
        setLogoUrl(laboratory.logo_url || '');
        setBrandColor(laboratory.brand_color || '#16a34a');
        setAnnualGoal(laboratory.annual_goal ? String(laboratory.annual_goal) : '');
      } else {
        setName('');
        setErpCode('');
        setLogoUrl('');
        setBrandColor('#16a34a');
        setAnnualGoal('');
      }
    }
  }, [open, laboratory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        erp_code: erpCode.trim(),
        logo_url: logoUrl.trim(),
        brand_color: brandColor,
        annual_goal: annualGoal ? Number(annualGoal) : null,
      });
      onOpenChange(false);
    } catch {
      // error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Laboratorio' : 'Nuevo Laboratorio'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modifica los datos del laboratorio.'
                : 'Registra un nuevo laboratorio para asignarle planes y promociones.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="lab-name">
                Nombre del Laboratorio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lab-name"
                placeholder="Ej: Zoetis, Boehringer…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </div>

            {/* ERP Code */}
            <div className="space-y-2">
              <Label htmlFor="lab-erp">SAP ID / Código Externo</Label>
              <Input
                id="lab-erp"
                placeholder="Ej: SAP-001"
                value={erpCode}
                onChange={(e) => setErpCode(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Recomendado para la integración con el ERP.
              </p>
            </div>

            {/* Logo URL */}
            <div className="space-y-2">
              <Label htmlFor="lab-logo">URL del Logo</Label>
              <Input
                id="lab-logo"
                type="url"
                placeholder="https://ejemplo.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
              {logoUrl && (
                <div className="flex items-center gap-2 mt-1">
                  <img
                    src={logoUrl}
                    alt="Preview"
                    className="h-8 w-8 rounded-md object-contain border border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Vista previa</span>
                </div>
              )}
            </div>

            {/* Brand Color */}
            <div className="space-y-2">
              <Label htmlFor="lab-color">Color de Marca</Label>
              <div className="flex items-center gap-3">
                <input
                  id="lab-color"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-10 w-14 rounded-md border border-input cursor-pointer"
                />
                <Input
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  placeholder="#16a34a"
                  className="flex-1"
                  maxLength={7}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Se usa para diferenciarlo en el Calendario Comercial.
              </p>
            </div>

            {/* Annual Goal */}
            <div className="space-y-2">
              <Label htmlFor="lab-goal">Meta Anual ($)</Label>
              <Input
                id="lab-goal"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={annualGoal}
                onChange={(e) => setAnnualGoal(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Laboratorio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
