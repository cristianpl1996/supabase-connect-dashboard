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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus, FlaskConical, ShieldCheck } from 'lucide-react';
import { useLaboratories, type Laboratory } from '@/hooks/useLaboratories';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { UserRole } from '@/hooks/useUsers';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  sales_rep: 'Sales Rep',
  promotor: 'Promotor',
};

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
  existingEmails: string[];
}

export function UserFormDialog({
  open,
  onOpenChange,
  onUserCreated,
  existingEmails,
}: UserFormDialogProps) {
  const { laboratories, isLoading: labsLoading } = useLaboratories();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('sales_rep');
  const [labId, setLabId] = useState('');
  const [approvalLimit, setApprovalLimit] = useState<string>('0');
  const [isSaving, setIsSaving] = useState(false);

  const isPromotor = role === 'promotor';

  useEffect(() => {
    if (open) {
      setEmail('');
      setRole('sales_rep');
      setLabId('');
      setApprovalLimit('0');
    }
  }, [open]);

  const validate = (): string | null => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return 'Ingresa un correo electrónico válido';
    }
    if (existingEmails.includes(trimmed)) {
      return 'Este usuario ya fue invitado';
    }
    if (isPromotor && !labId) {
      return 'Selecciona un laboratorio para el promotor';
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setIsSaving(true);
    try {
      const trimmedEmail = email.trim();

      // 1. Create the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: crypto.randomUUID(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;

      const newUserId = authData.user?.id;
      if (!newUserId) throw new Error('No se pudo obtener el ID del usuario creado');

      // 2. Create profile record
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: newUserId,
          email: trimmedEmail,
          role: isPromotor ? 'promotor' : role,
        });

      if (profileError) throw profileError;

      // 3. If Promotor, create the external_promoters record
      let selectedLab: Laboratory | undefined;
      if (isPromotor) {
        selectedLab = laboratories.find((l) => l.id === labId);
        const limit = parseFloat(approvalLimit) || 0;

        const { error: promoterError } = await supabase
          .from('external_promoters')
          .insert({
            user_id: newUserId,
            laboratory_id: labId,
            approval_limit: limit,
            is_active: true,
          });

        if (promoterError) throw promoterError;
      }

      toast.success(
        isPromotor
          ? `Promotor "${trimmedEmail}" creado y asignado a ${selectedLab?.name}`
          : `Usuario "${trimmedEmail}" invitado como ${ROLE_LABELS[role]}`
      );

      // 4. Notify parent to refetch
      onUserCreated();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al crear usuario: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invitar Usuario
          </DialogTitle>
          <DialogDescription>
            Crea un nuevo usuario y asígnale un rol en la plataforma
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="user-email">Correo Electrónico</Label>
            <Input
              id="user-email"
              type="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSaving}
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as UserRole)}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Admin
                  </span>
                </SelectItem>
                <SelectItem value="sales_rep">
                  <span className="flex items-center gap-2">
                    📊 Sales Rep
                  </span>
                </SelectItem>
                <SelectItem value="promotor">
                  <span className="flex items-center gap-2">
                    <FlaskConical className="h-3.5 w-3.5" />
                    Promotor
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Promotor Fields */}
          {isPromotor && (
            <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" />
                Configuración de Promotor
              </p>

              {/* Laboratory Select */}
              <div className="space-y-2">
                <Label htmlFor="promotor-lab">Asignar Laboratorio *</Label>
                {labsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando laboratorios…
                  </div>
                ) : laboratories.length === 0 ? (
                  <p className="text-sm text-destructive">
                    No hay laboratorios registrados. Crea uno primero en la pestaña "Laboratorios".
                  </p>
                ) : (
                  <Select
                    value={labId}
                    onValueChange={setLabId}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="promotor-lab">
                      <SelectValue placeholder="Seleccionar laboratorio…" />
                    </SelectTrigger>
                    <SelectContent>
                      {laboratories.map((lab) => (
                        <SelectItem key={lab.id} value={lab.id}>
                          <span className="flex items-center gap-2">
                            {lab.brand_color && (
                              <span
                                className="inline-block h-3 w-3 rounded-full border border-border"
                                style={{ backgroundColor: lab.brand_color }}
                              />
                            )}
                            {lab.name}
                            {lab.erp_code && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({lab.erp_code})
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Approval Limit */}
              <div className="space-y-2">
                <Label htmlFor="promotor-limit">Cupo de Aprobación ($)</Label>
                <Input
                  id="promotor-limit"
                  type="number"
                  min={0}
                  step={100}
                  placeholder="0"
                  value={approvalLimit}
                  onChange={(e) => setApprovalLimit(e.target.value)}
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">
                  Monto máximo que el promotor puede aprobar sin autorización del administrador.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPromotor ? 'Crear Promotor' : 'Invitar Usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
