import { useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Search } from 'lucide-react';
import type { Laboratory, LaboratoryFormData } from '@/hooks/useLaboratories';
import { listSupabaseBrands, type SupabaseBrand } from '@/lib/api';
import { cn } from '@/lib/utils';

interface LaboratoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  laboratory?: Laboratory | null;
  usedExternalBrandIds?: number[];
  onSubmit: (data: LaboratoryFormData) => Promise<void>;
}

export function LaboratoryFormDialog({
  open,
  onOpenChange,
  laboratory,
  usedExternalBrandIds = [],
  onSubmit,
}: LaboratoryFormDialogProps) {
  const [externalBrandId, setExternalBrandId] = useState<number | null>(null);
  const [brands, setBrands] = useState<SupabaseBrand[]>([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [erpCode, setErpCode] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#16a34a');
  const [annualGoal, setAnnualGoal] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!laboratory;
  const unavailableBrandIds = new Set(
    usedExternalBrandIds.filter((id) => id !== laboratory?.external_brand_id),
  );
  const selectedBrand = brands.find((brand) => brand.id === externalBrandId);
  const filteredBrands = brands
    .filter((brand) => !unavailableBrandIds.has(brand.id))
    .filter((brand) => {
      const term = brandSearch.trim().toLowerCase();
      if (!term) return true;
      return [brand.name, brand.code, brand.type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });

  useEffect(() => {
    if (!open) return;

    if (laboratory) {
      setExternalBrandId(laboratory.external_brand_id);
      setErpCode(laboratory.erp_code || '');
      setLogoUrl(laboratory.logo_url || '');
      setBrandColor(laboratory.brand_color || '#16a34a');
      setAnnualGoal(laboratory.annual_goal ? String(laboratory.annual_goal) : '');
    } else {
      setExternalBrandId(null);
      setErpCode('');
      setLogoUrl('');
      setBrandColor('#16a34a');
      setAnnualGoal('');
    }
    setBrandSearch('');
  }, [open, laboratory]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoadingBrands(true);
    listSupabaseBrands({ limit: 1000 })
      .then((items) => {
        if (cancelled) return;
        setBrands(items.filter((brand) => brand.id && brand.name));
      })
      .catch(() => {
        if (!cancelled) setBrands([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingBrands(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (externalBrandId == null) return;

    setIsSaving(true);
    try {
      await onSubmit({
        external_brand_id: externalBrandId,
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
            <DialogTitle>{isEditing ? 'Editar Laboratorio' : 'Nuevo Laboratorio'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modifica la marca oficial y los datos internos del laboratorio.'
                : 'Selecciona una marca oficial para asignarle planes y promociones.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lab-brand-search">
                Marca oficial <span className="text-destructive">*</span>
              </Label>
              <div className="overflow-hidden rounded-md border border-input bg-background transition-colors focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20">
                <div className="flex items-center border-b border-input/70 px-3">
                  <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="lab-brand-search"
                    placeholder="Buscar brand oficial..."
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    className="h-10 rounded-none border-0 bg-transparent px-0 shadow-none outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto p-1">
                  {isLoadingBrands ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando marcas...
                    </div>
                  ) : filteredBrands.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No hay marcas disponibles
                    </p>
                  ) : (
                    filteredBrands.map((brand) => (
                      <button
                        key={brand.id}
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm hover:bg-muted',
                          externalBrandId === brand.id && 'bg-primary/10 text-primary',
                        )}
                        onClick={() => setExternalBrandId(brand.id)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{brand.name}</span>
                          {brand.code && (
                            <span className="block truncate text-xs text-muted-foreground">{brand.code}</span>
                          )}
                        </span>
                        {externalBrandId === brand.id && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
              {selectedBrand && (
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-medium">{selectedBrand.name}</span>
                  <Badge variant="outline">ID {selectedBrand.id}</Badge>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lab-erp">SAP ID / Codigo Externo</Label>
              <Input
                id="lab-erp"
                placeholder="Ej: SAP-001"
                value={erpCode}
                onChange={(e) => setErpCode(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Recomendado para la integracion con el ERP.
              </p>
            </div>

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
                <div className="mt-1 flex items-center gap-2">
                  <img
                    src={logoUrl}
                    alt="Preview"
                    className="h-8 w-8 rounded-md border border-border object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Vista previa</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lab-color">Color de Marca</Label>
              <div className="flex items-center gap-3">
                <input
                  id="lab-color"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-md border border-input"
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
            <Button type="submit" disabled={isSaving || externalBrandId == null}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Laboratorio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
