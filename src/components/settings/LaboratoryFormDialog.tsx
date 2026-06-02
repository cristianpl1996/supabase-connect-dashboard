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

const EMPTY_USED_EXTERNAL_BRAND_IDS: number[] = [];

type FormErrors = Partial<Record<'brand' | 'erpCode' | 'logoUrl', string>>;

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
  usedExternalBrandIds = EMPTY_USED_EXTERNAL_BRAND_IDS,
  onSubmit,
}: LaboratoryFormDialogProps) {
  const [externalBrandId, setExternalBrandId] = useState<number | null>(null);
  const [brands, setBrands] = useState<SupabaseBrand[]>([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [erpCode, setErpCode] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#16a34a');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const isEditing = !!laboratory;
  const unavailableBrandIds = new Set(
    usedExternalBrandIds.filter((id) => id !== laboratory?.external_brand_id),
  );
  const selectedBrand = brands.find((brand) => brand.id === externalBrandId);
  const filteredBrands = brands.filter((brand) => {
    const term = brandSearch.trim().toLowerCase();
    if (!term) return true;
    return [brand.name, brand.code, brand.type]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  useEffect(() => {
    if (!open) return;
    setErrors({});

    if (laboratory) {
      setExternalBrandId(laboratory.external_brand_id);
      setErpCode(laboratory.erp_code || '');
      setLogoUrl(laboratory.logo_url || '');
      setBrandColor(laboratory.brand_color || '#16a34a');
    } else {
      setExternalBrandId(null);
      setErpCode('');
      setLogoUrl('');
      setBrandColor('#16a34a');
    }
    setBrandSearch('');
  }, [open, laboratory]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoadingBrands(true);
    listSupabaseBrands()
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

    return () => { cancelled = true; };
  }, [open]);

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (externalBrandId == null) {
      next.brand = 'Debes seleccionar una marca oficial';
    }

    if (!erpCode.trim()) {
      next.erpCode = 'El SAP ID / Código Externo es requerido';
    } else if (erpCode.trim().length < 2) {
      next.erpCode = 'Mínimo 2 caracteres';
    }

    if (logoUrl.trim()) {
      try {
        new URL(logoUrl.trim());
      } catch {
        next.logoUrl = 'La URL del logo no es válida';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSubmit({
        external_brand_id: externalBrandId!,
        erp_code: erpCode.trim(),
        logo_url: logoUrl.trim(),
        brand_color: brandColor,
        annual_goal: null,
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
        <DialogHeader className="text-left">
          <DialogTitle>{isEditing ? 'Editar Laboratorio' : 'Nuevo Laboratorio'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica la marca oficial y los datos internos del laboratorio.'
              : 'Selecciona una marca oficial para asignarle planes y promociones.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Marca oficial */}
            <div className="space-y-1.5">
              <Label htmlFor="lab-brand-search">
                Marca oficial <span className="text-destructive">*</span>
              </Label>
              <div
                className={cn(
                  'overflow-hidden rounded-md border bg-background transition-colors focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20',
                  errors.brand ? 'border-destructive' : 'border-input',
                )}
              >
                <div className="flex items-center border-b border-input/70 px-3">
                  <Search className="mr-2 size-4 text-muted-foreground" />
                  <Input
                    id="lab-brand-search"
                    placeholder="Buscar brand oficial…"
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    className="h-10 rounded-none border-0 bg-transparent px-0 shadow-none outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto p-1">
                  {isLoadingBrands ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Cargando marcas…
                    </div>
                  ) : filteredBrands.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No hay marcas disponibles
                    </p>
                  ) : (
                    filteredBrands.map((brand) => {
                      const isUnavailable = unavailableBrandIds.has(brand.id);
                      return (
                        <button
                          key={brand.id}
                          type="button"
                          disabled={isUnavailable}
                          className={cn(
                            'flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm',
                            isUnavailable
                              ? 'cursor-not-allowed opacity-40'
                              : 'hover:bg-muted',
                            externalBrandId === brand.id && 'bg-primary/10 text-primary',
                          )}
                          onClick={() => {
                            if (isUnavailable) return;
                            setExternalBrandId(brand.id);
                            if (errors.brand) setErrors((er) => ({ ...er, brand: undefined }));
                          }}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{brand.name}</span>
                            <span className="flex items-center gap-1.5 mt-0.5">
                              {brand.code && (
                                <span className="truncate text-xs text-muted-foreground font-mono">
                                  {brand.code}
                                </span>
                              )}
                              <span className="shrink-0 rounded-full border border-border bg-muted/60 px-1.5 py-px text-[10px] font-mono text-muted-foreground">
                                ID {brand.id}
                              </span>
                            </span>
                          </span>
                          {isUnavailable
                            ? <span className="ml-2 shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">En uso</span>
                            : externalBrandId === brand.id && <Check className="size-4 shrink-0" />
                          }
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              {errors.brand ? (
                <p className="text-xs text-destructive">{errors.brand}</p>
              ) : selectedBrand ? (
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-medium">{selectedBrand.name}</span>
                  <Badge variant="outline">ID {selectedBrand.id}</Badge>
                </div>
              ) : null}
            </div>

            {/* SAP ID */}
            <div className="space-y-1.5">
              <Label htmlFor="lab-erp">
                SAP ID / Código Externo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lab-erp"
                placeholder="Ej: SAP-001"
                value={erpCode}
                onChange={(e) => {
                  setErpCode(e.target.value);
                  if (errors.erpCode) setErrors((er) => ({ ...er, erpCode: undefined }));
                }}
                maxLength={50}
                disabled={isSaving}
                className={cn(errors.erpCode && 'border-destructive focus-visible:ring-destructive/30')}
              />
              {errors.erpCode ? (
                <p className="text-xs text-destructive">{errors.erpCode}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Código utilizado para la integración con SAP Business One.
                </p>
              )}
            </div>

            {/* Logo URL — opcional */}
            <div className="space-y-1.5">
              <Label htmlFor="lab-logo">
                URL del Logo{' '}
                <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="lab-logo"
                type="text"
                placeholder="https://ejemplo.com/logo.png"
                value={logoUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value);
                  if (errors.logoUrl) setErrors((er) => ({ ...er, logoUrl: undefined }));
                }}
                disabled={isSaving}
                className={cn(errors.logoUrl && 'border-destructive focus-visible:ring-destructive/30')}
              />
              {errors.logoUrl ? (
                <p className="text-xs text-destructive">{errors.logoUrl}</p>
              ) : logoUrl ? (
                <div className="flex items-center gap-2">
                  <img
                    src={logoUrl}
                    alt="Preview"
                    className="size-8 rounded-md border border-border object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-xs text-muted-foreground">Vista previa</span>
                </div>
              ) : null}
            </div>

            {/* Color de Marca */}
            <div className="space-y-1.5">
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
                  className="flex-1 font-mono"
                  maxLength={7}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Se usa para diferenciarlo en el Calendario Comercial.
              </p>
            </div>

          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Laboratorio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
