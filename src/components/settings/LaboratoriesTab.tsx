import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { FlaskConical, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useLaboratories, type Laboratory } from '@/hooks/useLaboratories';
import { LaboratoryFormDialog } from './LaboratoryFormDialog';
import { toast } from 'sonner';

export function LaboratoriesTab() {
  const { laboratories, isLoading, createLab, updateLab, deleteLab } = useLaboratories();

  const [formOpen, setFormOpen] = useState(false);
  const [editingLab, setEditingLab] = useState<Laboratory | null>(null);
  const [deletingLab, setDeletingLab] = useState<Laboratory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        await updateLab(editingLab.id, data);
        toast.success(`Laboratorio "${data.name}" actualizado`);
      } else {
        await createLab(data);
        toast.success(`Laboratorio "${data.name}" creado`);
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

  const formatCurrency = (val: number | null) => {
    if (val == null) return '—';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                Laboratorios
              </CardTitle>
              <CardDescription className="mt-1">
                {laboratories.length} laboratorio{laboratories.length !== 1 ? 's' : ''} registrado{laboratories.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Laboratorio
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando laboratorios…</span>
            </div>
          ) : laboratories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No hay laboratorios registrados</p>
              <p className="text-sm mt-1">
                Crea tu primer laboratorio para empezar a asignar planes y promociones.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Logo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>ID Externo (SAP)</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right">Meta Anual</TableHead>
                  <TableHead className="text-right w-[120px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laboratories.map((lab) => (
                  <TableRow key={lab.id}>
                    <TableCell>
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={lab.logo_url || ''} alt={lab.name} />
                        <AvatarFallback
                          className="text-xs font-bold"
                          style={lab.brand_color ? { backgroundColor: lab.brand_color, color: '#fff' } : undefined}
                        >
                          {lab.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{lab.name}</TableCell>
                    <TableCell>
                      {lab.erp_code ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {lab.erp_code}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lab.brand_color ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-5 w-5 rounded-full border border-border"
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
                    <TableCell className="text-right font-medium">
                      {formatCurrency(lab.annual_goal)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(lab)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingLab(lab)}
                          className="text-destructive hover:text-destructive"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <LaboratoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        laboratory={editingLab}
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
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
