import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FlaskConical, Plus, Pencil, Trash2, Loader2, Search, X } from 'lucide-react';
import { useLaboratories, type Laboratory } from '@/hooks/useLaboratories';
import { LaboratoryFormDialog } from './LaboratoryFormDialog';
import { ModuleErrorCard } from '@/components/common/ModuleErrorCard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LaboratoriesTabProps {
  onError?: (hasError: boolean) => void;
}

export function LaboratoriesTab({ onError }: LaboratoriesTabProps) {
  const { laboratories, isLoading, isError, errorMessage, refetch, createLab, updateLab, deleteLab } = useLaboratories();

  useEffect(() => { onError?.(isError); }, [isError, onError]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingLab, setEditingLab] = useState<Laboratory | null>(null);
  const [deletingLab, setDeletingLab] = useState<Laboratory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('name_asc');

  const filtered = laboratories
    .filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()))
    .filter((l) => {
      if (brandFilter === 'linked') return l.external_brand_id != null;
      if (brandFilter === 'unlinked') return l.external_brand_id == null;
      return true;
    })
    .sort((a, b) => {
      if (sortFilter === 'name_asc') return a.name.localeCompare(b.name);
      if (sortFilter === 'name_desc') return b.name.localeCompare(a.name);
      if (sortFilter === 'goal_desc') return (b.annual_goal ?? 0) - (a.annual_goal ?? 0);
      if (sortFilter === 'goal_asc') return (a.annual_goal ?? 0) - (b.annual_goal ?? 0);
      return 0;
    });

  const hasActiveFilters = !!(search || brandFilter !== 'all');
  const clearFilters = () => { setSearch(''); setBrandFilter('all'); setSortFilter('name_asc'); };

  const handleCreate = () => {
    setEditingLab(null);
    setFormOpen(true);
  };

  const handleEdit = (lab: Laboratory) => {
    setEditingLab(lab);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: Parameters<typeof createLab>[0]) => {
    try {
      if (editingLab) {
        const updated = await updateLab(editingLab.id, data);
        toast.success(`Laboratorio "${updated.name}" actualizado`);
      } else {
        const created = await createLab(data);
        toast.success(`Laboratorio "${created.name}" creado`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error: ${message}`);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletingLab) return;
    setIsDeleting(true);
    try {
      await deleteLab(deletingLab.id);
      toast.success(`Laboratorio "${deletingLab.name}" eliminado`);
      setDeletingLab(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`No se pudo eliminar: ${message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={cn("flex items-center gap-2", isError && "text-muted-foreground")}>
                <FlaskConical className={cn("size-5", isError ? "text-primary/40" : "text-primary")} />
                Laboratorios
              </CardTitle>
              <CardDescription className="mt-1">
                {isLoading ? (
                  <span className="inline-block h-4 w-40 animate-pulse rounded bg-muted" />
                ) : isError ? (
                  'No se pudieron cargar los laboratorios'
                ) : hasActiveFilters ? (
                  `${filtered.length} de ${laboratories.length} laboratorio${laboratories.length !== 1 ? 's' : ''}`
                ) : (
                  `${laboratories.length} laboratorio${laboratories.length !== 1 ? 's' : ''} registrado${laboratories.length !== 1 ? 's' : ''}`
                )}
              </CardDescription>
            </div>
            <Button onClick={handleCreate} disabled={isLoading || isError} className="gap-2">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nuevo </span>Laboratorio
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Error card ─────────────────────────────────────────────── */}
          {isError && (
            <ModuleErrorCard
              message={errorMessage}
              onRetry={refetch}
              loading={isLoading}
            />
          )}

          {/* ── Filter bar ─────────────────────────────────────────────── */}
          {!isError && <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative sm:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por laboratorio"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9 h-9 text-sm"
                disabled={isLoading || isError}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Selects — 2-col grid on mobile, inline on sm+ */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
              <Select value={brandFilter} onValueChange={setBrandFilter} disabled={isLoading || isError}>
                <SelectTrigger className="h-9 text-sm w-full sm:w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las brands</SelectItem>
                  <SelectItem value="linked">Con brand vinculada</SelectItem>
                  <SelectItem value="unlinked">Sin brand vinculada</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortFilter} onValueChange={setSortFilter} disabled={isLoading || isError}>
                <SelectTrigger className="h-9 text-sm w-full sm:w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name_asc">Nombre A → Z</SelectItem>
                  <SelectItem value="name_desc">Nombre Z → A</SelectItem>
                  <SelectItem value="goal_desc">Meta mayor</SelectItem>
                  <SelectItem value="goal_asc">Meta menor</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="col-span-2 sm:col-span-1 inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3" /> Limpiar
                </button>
              )}
            </div>
          </div>}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-10 text-muted-foreground">
              <FlaskConical className="size-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No se pudieron cargar los laboratorios</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FlaskConical className="size-12 mx-auto mb-4 opacity-30" />
              <p>{hasActiveFilters ? 'Sin resultados para los filtros aplicados' : 'No hay laboratorios registrados'}</p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} className="mt-4">
                  <X className="size-4 mr-2" /> Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[48px]">Logo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden sm:table-cell">ID Externo (SAP)</TableHead>
                    <TableHead className="hidden md:table-cell">Brand Externa</TableHead>
                    <TableHead className="hidden md:table-cell">Color</TableHead>
                    <TableHead className="text-right w-[80px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lab) => (
                    <TableRow key={lab.id}>
                      <TableCell>
                        <Avatar className="size-8">
                          <AvatarImage src={lab.logo_url || ''} alt={lab.name} />
                          <AvatarFallback
                            className="text-xs font-bold"
                            style={lab.brand_color ? { backgroundColor: lab.brand_color, color: '#fff' } : undefined}
                          >
                            {lab.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>{lab.name}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {lab.erp_code ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {lab.erp_code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {lab.external_brand_id ? (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {lab.external_brand_id}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Sin enlazar
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {lab.brand_color ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="size-5 rounded-full border border-border"
                              style={{ backgroundColor: lab.brand_color }}
                            />
                            <span className="text-xs text-muted-foreground font-mono">
                              {lab.brand_color}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(lab)}
                            title="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingLab(lab)}
                            className="text-destructive hover:text-destructive"
                            title="Eliminar"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <LaboratoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        laboratory={editingLab}
        usedExternalBrandIds={laboratories
          .map((lab) => lab.external_brand_id)
          .filter((id): id is number => id != null)}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingLab} onOpenChange={(open) => !open && setDeletingLab(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar laboratorio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>"{deletingLab?.name}"</strong> permanentemente.
              Esto puede afectar planes y promociones asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="size-4 animate-spin mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
