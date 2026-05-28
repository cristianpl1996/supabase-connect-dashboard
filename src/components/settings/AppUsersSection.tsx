import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AppUserRecord,
  AppUserCreate,
  AppUserUpdate,
  AppUserFilters,
  listAppUsers,
  createAppUser,
  updateAppUser,
  deactivateAppUser,
  getAllRepresentatives,
  Representative,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, Info, Loader2, Plus, Pencil, UserX, Users, Eye, EyeOff, ShieldCheck, UserCog, UserRound, Lock, Search, X } from 'lucide-react';
import { ModuleErrorCard } from '@/components/common/ModuleErrorCard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PasswordReq {
  label: string;
  met: boolean;
}

function getPasswordReqs(pwd: string): PasswordReq[] {
  return [
    { label: 'Mínimo 8 caracteres', met: pwd.length >= 8 },
    { label: 'Una letra mayúscula', met: /[A-Z]/.test(pwd) },
    { label: 'Un número', met: /[0-9]/.test(pwd) },
    { label: 'Un carácter especial', met: /[^A-Za-z0-9]/.test(pwd) },
  ];
}

function getStrengthLevel(reqs: PasswordReq[]): { score: number; label: string; color: string } {
  const score = reqs.filter((r) => r.met).length;
  if (score <= 1) return { score, label: 'Bajo', color: 'bg-red-500' };
  if (score <= 3) return { score, label: 'Medio', color: 'bg-amber-400' };
  return { score, label: 'Alto', color: 'bg-green-500' };
}

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const reqs = getPasswordReqs(password);
  const { score, label, color } = getStrengthLevel(reqs);

  const badgeVariants: Record<string, string> = {
    Bajo: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
    Medio: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    Alto: 'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800',
  };

  return (
    <div className="mt-5 rounded-xl border bg-muted/30 p-3.5 space-y-3">
      {/* Header + bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Seguridad de la contraseña</span>
          <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-none', badgeVariants[label])}>
            {label}
          </span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                'h-2 flex-1 rounded-full transition-all duration-300',
                i <= score ? color : 'bg-border',
              )}
            />
          ))}
        </div>
      </div>

      {/* Requirements grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {reqs.map((req) => (
          <div key={req.label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
                req.met
                  ? 'border-green-500 bg-green-500'
                  : 'border-border bg-background',
              )}
            >
              {req.met && <Check className="size-2.5 text-white stroke-[3]" />}
            </div>
            <span
              className={cn(
                'text-xs leading-tight transition-colors duration-200',
                req.met ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  supervisor: 'Supervisor',
  sales_rep: 'Representante',
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  superadmin: ShieldCheck,
  supervisor: UserCog,
  sales_rep: UserRound,
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-primary/10 text-primary border-primary/30',
  supervisor: 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400',
  sales_rep: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
};

type FormErrors = Partial<Record<
  'username' | 'password' | 'role' | 'sales_representative_id' | 'phone',
  string
>>;

const EMPTY_FORM: AppUserCreate = {
  username: '',
  password: '',
  role: 'sales_rep',
  phone: '',
  distributor_id: 0,
  sales_representative_id: null,
  requires_otp: false,
};

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/-/g, '');
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

interface AppUsersSectionProps {
  onError?: (hasError: boolean) => void;
}

export function AppUsersSection({ onError }: AppUsersSectionProps) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppUserRecord | null>(null);
  const [form, setForm] = useState<AppUserCreate>(EMPTY_FORM);
  const [editPassword, setEditPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [otpFilter, setOtpFilter] = useState('all');
  const [phoneFilter, setPhoneFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('username');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const activeFilters: AppUserFilters = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(roleFilter !== 'all' ? { role: roleFilter } : {}),
    ...(statusFilter !== 'all' ? { is_active: statusFilter === 'active' } : {}),
    ...(otpFilter !== 'all' ? { requires_otp: otpFilter === 'yes' } : {}),
    ...(phoneFilter !== 'all' ? { has_phone: phoneFilter === 'yes' } : {}),
    order_by: sortFilter,
  };

  const { data: appUsers = [], isLoading, isError, error, refetch } = useQuery<AppUserRecord[]>({
    queryKey: ['app-users', activeFilters],
    queryFn: () => listAppUsers(activeFilters),
    refetchOnMount: 'always',
    gcTime: 0,
    retry: false,
  });
  const errorMessage = isError && error instanceof Error ? error.message : 'Error al cargar usuarios';

  useEffect(() => { onError?.(isError); }, [isError, onError]);

  const { data: allUsers = [] } = useQuery<AppUserRecord[]>({
    queryKey: ['app-users'],
    queryFn: () => listAppUsers(),
    refetchOnMount: 'always',
    gcTime: 0,
    retry: false,
  });

  const { data: representatives = [] } = useQuery<Representative[]>({
    queryKey: ['representatives-all'],
    queryFn: getAllRepresentatives,
    refetchOnMount: 'always',
    gcTime: 0,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: createAppUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-users'] });
      toast.success('Usuario creado correctamente');
      setDialogOpen(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error al crear usuario';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AppUserUpdate }) => updateAppUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-users'] });
      toast.success('Usuario actualizado');
      setDialogOpen(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error al actualizar';
      toast.error(msg);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateAppUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-users'] });
      toast.success('Usuario desactivado');
    },
  });

  // A superadmin cannot edit/deactivate OTHER superadmins, but CAN edit themselves.
  // Nobody can deactivate themselves.
  const getEditProtection = (u: AppUserRecord): string | null => {
    if (u.role === 'superadmin' && u.id !== currentUser?.id && currentUser?.role === 'superadmin')
      return 'No puedes editar a otro superadmin';
    return null;
  };

  const getDeactivateProtection = (u: AppUserRecord): string | null => {
    if (u.id === currentUser?.id) return 'No puedes desactivar tu propia cuenta';
    if (u.role === 'superadmin' && currentUser?.role === 'superadmin')
      return 'No puedes desactivar a otro superadmin';
    return null;
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setEditPassword('');
    setShowPassword(false);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (u: AppUserRecord) => {
    setEditing(u);
    setForm({
      username: u.username,
      password: '',
      role: u.role,
      phone: u.phone ?? '',
      distributor_id: u.distributor_id,
      sales_representative_id: u.sales_representative_id ?? null,
      requires_otp: u.requires_otp,
    });
    setEditPassword('');
    setShowPassword(false);
    setErrors({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const next: FormErrors = {};

    // Username
    const uname = form.username.trim();
    if (!uname) next.username = 'El nombre de usuario es requerido';
    else if (uname.length < 3) next.username = 'Mínimo 3 caracteres';
    else if (/\s/.test(uname)) next.username = 'No puede contener espacios';
    else {
      const duplicate = allUsers.find(
        (u) => u.username.toLowerCase() === uname.toLowerCase() && u.id !== editing?.id,
      );
      if (duplicate) next.username = 'Este nombre de usuario ya está en uso';
    }

    // Password
    const pwd = editing ? editPassword : form.password;
    if (!editing && !pwd) {
      next.password = 'La contraseña es requerida';
    } else if (pwd) {
      const reqs = getPasswordReqs(pwd);
      const unmet = reqs.filter((r) => !r.met);
      if (unmet.length > 0) {
        next.password = unmet[0].label;
      }
    }

    // Phone
    const phone = normalizePhone(form.phone ?? '');
    if (phone && !isValidPhone(phone)) {
      next.phone = 'Número inválido (mínimo 7 dígitos)';
    } else if (phone) {
      const duplicate = allUsers.find(
        (u) => normalizePhone(u.phone ?? '') === phone && u.id !== editing?.id,
      );
      if (duplicate) next.phone = `Este número ya está registrado en "${duplicate.username}"`;
    }

    // OTP requires phone
    if (form.requires_otp && !phone) {
      next.phone = 'Se requiere un número de teléfono para activar la verificación OTP';
    }

    // Sales rep must be linked
    if (form.role === 'sales_rep' && !form.sales_representative_id) {
      next.sales_representative_id = 'Debes vincular un representante ERP para este rol';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const phone = normalizePhone(form.phone ?? '') || null;

    if (editing) {
      const update: AppUserUpdate = {
        username: form.username.trim(),
        role: form.role,
        phone,
        distributor_id: form.distributor_id,
        sales_representative_id: form.sales_representative_id,
        requires_otp: form.requires_otp,
      };
      if (editPassword) update.password = editPassword;
      updateMutation.mutate({ id: editing.id, data: update });
    } else {
      createMutation.mutate({ ...form, username: form.username.trim(), phone });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isSalesRep = form.role === 'sales_rep';

  const hasActiveFilters = !!(search || roleFilter !== 'all' || otpFilter !== 'all' || phoneFilter !== 'all');
  const clearFilters = () => { setSearch(''); setRoleFilter('all'); setOtpFilter('all'); setPhoneFilter('all'); setSortFilter('username'); };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={cn("flex items-center gap-2", isError && "text-muted-foreground")}>
                <Users className={cn("size-5", isError ? "text-primary/40" : "text-primary")} />
                Gestión de Usuarios
              </CardTitle>
              <CardDescription className="mt-1">
                {isLoading ? (
                  <span className="inline-block h-4 w-40 animate-pulse rounded bg-muted" />
                ) : isError ? (
                  'No se pudieron cargar los usuarios'
                ) : hasActiveFilters ? (
                  `${appUsers.length} de ${allUsers.length} usuario${allUsers.length !== 1 ? 's' : ''}`
                ) : (
                  `${allUsers.length} usuario${allUsers.length !== 1 ? 's' : ''} registrado${allUsers.length !== 1 ? 's' : ''}`
                )}
              </CardDescription>
            </div>
            <Button onClick={openCreate} disabled={isLoading || isError} className="gap-2">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nuevo </span>Usuario
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Error card ─────────────────────────────────────────────── */}
          {isError && (
            <ModuleErrorCard
              message={errorMessage}
              onRetry={() => void refetch()}
              loading={isLoading}
            />
          )}

          {/* ── Filter bar ─────────────────────────────────────────────── */}
          {!isError && <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search — 2× wider than each select */}
            <div className="relative sm:flex-[2] sm:min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por usuario"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9 h-9 text-sm w-full"
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

            {/* Selects — 2-col grid mobile; each wrapped in flex-1 div on sm+ */}
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <div className="sm:flex-1 sm:min-w-0">
                <Select value={roleFilter} onValueChange={setRoleFilter} disabled={isLoading || isError}>
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    <SelectItem value="superadmin">
                      <span className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-primary" />Superadmin</span>
                    </SelectItem>
                    <SelectItem value="supervisor">
                      <span className="flex items-center gap-2"><UserCog className="size-3.5 text-blue-600" />Supervisor</span>
                    </SelectItem>
                    <SelectItem value="sales_rep">
                      <span className="flex items-center gap-2"><UserRound className="size-3.5 text-amber-600" />Representante</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:flex-1 sm:min-w-0">
                <Select value={otpFilter} onValueChange={setOtpFilter} disabled={isLoading || isError}>
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Verificación OTP</SelectItem>
                    <SelectItem value="yes">Con OTP activo</SelectItem>
                    <SelectItem value="no">Sin OTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:flex-1 sm:min-w-0">
                <Select value={phoneFilter} onValueChange={setPhoneFilter} disabled={isLoading || isError}>
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los teléfonos</SelectItem>
                    <SelectItem value="yes">Con teléfono</SelectItem>
                    <SelectItem value="no">Sin teléfono</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:flex-1 sm:min-w-0">
                <Select value={sortFilter} onValueChange={setSortFilter} disabled={isLoading || isError}>
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="username">Nombre A → Z</SelectItem>
                    <SelectItem value="role">Por rol</SelectItem>
                    <SelectItem value="id">Más reciente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="col-span-2 sm:col-span-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
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
              <Users className="size-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No se pudieron cargar los usuarios</p>
            </div>
          ) : appUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="size-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{hasActiveFilters ? 'Sin resultados para los filtros aplicados' : 'No hay usuarios registrados'}</p>
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
                  <TableHead>Usuario</TableHead>
                  <TableHead className="hidden sm:table-cell">Rol</TableHead>
                  <TableHead className="hidden lg:table-cell">Representante vinculado</TableHead>
                  <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                  <TableHead className="hidden md:table-cell">OTP</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-20 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appUsers.map((u) => {
                  const linkedRep = representatives.find((r) => r.id === u.sales_representative_id);
                  const RoleIcon = ROLE_ICONS[u.role] ?? UserRound;
                  const editProtection = getEditProtection(u);
                  const deactivateProtection = getDeactivateProtection(u);

                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1.5">
                            {u.username}
                            {u.id === currentUser?.id && (
                              <Badge variant="outline" className="px-1.5 py-0 h-5 text-[11px] font-medium">Tú</Badge>
                            )}
                          </span>
                          {/* Rol visible solo en mobile */}
                          <span className="sm:hidden">
                            <Badge variant="outline" className={cn('gap-1 text-[11px]', ROLE_COLORS[u.role])}>
                              <RoleIcon className="size-3" />
                              {ROLE_LABELS[u.role] ?? u.role}
                            </Badge>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className={cn('gap-1', ROLE_COLORS[u.role])}>
                          <RoleIcon className="size-3" />
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                        {linkedRep?.sales_rep_full_name ?? <span className="opacity-40">–</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono hidden lg:table-cell">
                        {u.phone ?? <span className="opacity-40">–</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {u.requires_otp ? (
                          <Badge className="text-xs border border-green-200 bg-green-50 text-green-700 hover:bg-green-50">Sí</Badge>
                        ) : (
                          <Badge className="text-xs border border-gray-200 bg-white text-gray-500 hover:bg-white">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.is_active ? (
                          <Badge className="text-xs border border-green-200 bg-green-50 text-green-700 hover:bg-green-50">Activado</Badge>
                        ) : (
                          <Badge className="text-xs border border-gray-200 bg-white text-gray-500 hover:bg-white">Desactivado</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit button */}
                          {editProtection ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex size-8 items-center justify-center rounded-md text-muted-foreground/30">
                                  <Lock className="size-3.5" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-48 text-center">
                                {editProtection}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(u)}
                              title="Editar usuario"
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}

                          {/* Deactivate button */}
                          {u.is_active && (
                            deactivateProtection ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex size-8 items-center justify-center rounded-md text-muted-foreground/30">
                                    <UserX className="size-3.5" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-48 text-center">
                                  {deactivateProtection}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deactivateMutation.mutate(u.id)}
                                disabled={deactivateMutation.isPending}
                                title="Desactivar usuario"
                              >
                                <UserX className="size-4" />
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle>{editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Modifica los datos del usuario. Deja la contraseña vacía para no cambiarla.'
                : 'Completa los datos para crear un nuevo usuario con acceso a la aplicación.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="usr-username">
                  Usuario <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="usr-username"
                  placeholder="ej: carlos.gomez"
                  value={form.username}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, username: e.target.value }));
                    if (errors.username) setErrors((er) => ({ ...er, username: undefined }));
                  }}
                  disabled={isSaving}
                  className={cn(errors.username && 'border-destructive focus-visible:ring-destructive/30')}
                />
                {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="usr-password">
                    {editing ? 'Nueva contraseña' : 'Contraseña'}{' '}
                    {!editing && <span className="text-destructive">*</span>}
                  </Label>
                  {editing && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-default items-center gap-1 rounded-full border border-muted-foreground/20 bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <Info className="size-3 shrink-0" />
                          Opcional
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-52 text-center text-xs">
                        Deja vacío si no deseas cambiar la contraseña actual del usuario
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="usr-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={editing ? '••••••••' : 'Mínimo 8 caracteres'}
                    value={editing ? editPassword : form.password}
                    onChange={(e) => {
                      if (editing) {
                        setEditPassword(e.target.value);
                      } else {
                        setForm((f) => ({ ...f, password: e.target.value }));
                      }
                      if (errors.password) setErrors((er) => ({ ...er, password: undefined }));
                    }}
                    disabled={isSaving}
                    className={cn(
                      'pr-10',
                      errors.password && 'border-destructive focus-visible:ring-destructive/30',
                    )}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
              <PasswordStrengthMeter password={editing ? editPassword : form.password} />

              {/* Role */}
              <div className="space-y-1.5">
                <Label>
                  Rol <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => {
                    setForm((f) => ({
                      ...f,
                      role: v as AppUserCreate['role'],
                      sales_representative_id: v !== 'sales_rep' ? null : f.sales_representative_id,
                    }));
                    if (errors.sales_representative_id)
                      setErrors((er) => ({ ...er, sales_representative_id: undefined }));
                  }}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_rep">
                      <span className="flex items-center gap-2">
                        <UserRound className="size-4 text-amber-600" />
                        Representante de venta
                      </span>
                    </SelectItem>
                    <SelectItem value="supervisor">
                      <span className="flex items-center gap-2">
                        <UserCog className="size-4 text-blue-600" />
                        Supervisor
                      </span>
                    </SelectItem>
                    <SelectItem value="superadmin">
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-primary" />
                        Superadmin
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Representative — only for sales_rep */}
              {isSalesRep && (
                <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-500/25 dark:bg-amber-500/5">
                  <Label className="text-sm font-medium">
                    Representante ERP vinculado{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.sales_representative_id?.toString() ?? 'none'}
                    onValueChange={(v) => {
                      setForm((f) => ({
                        ...f,
                        sales_representative_id: v === 'none' ? null : Number(v),
                      }));
                      if (errors.sales_representative_id)
                        setErrors((er) => ({ ...er, sales_representative_id: undefined }));
                    }}
                    disabled={isSaving}
                  >
                    <SelectTrigger
                      className={cn(
                        errors.sales_representative_id && 'border-destructive focus:ring-destructive/30',
                      )}
                    >
                      <SelectValue placeholder="Seleccionar representante…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin vincular</SelectItem>
                      {representatives.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.sales_rep_full_name ?? `Rep #${r.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.sales_representative_id ? (
                    <p className="text-xs text-destructive">{errors.sales_representative_id}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Vincula la ficha ERP para que su nombre aparezca en reportes de agotados.
                    </p>
                  )}
                </div>
              )}

              {/* Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="usr-phone">Teléfono</Label>
                <Input
                  id="usr-phone"
                  placeholder="+57 300 000 0000"
                  value={form.phone ?? ''}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, phone: e.target.value }));
                    if (errors.phone) setErrors((er) => ({ ...er, phone: undefined }));
                  }}
                  disabled={isSaving}
                  className={cn(errors.phone && 'border-destructive focus-visible:ring-destructive/30')}
                />
                {errors.phone ? (
                  <p className="text-xs text-destructive">{errors.phone}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Requerido si se activa la verificación OTP.
                  </p>
                )}
              </div>

              {/* OTP Toggle */}
              <div className={cn(
                'flex items-center justify-between rounded-lg border p-3 transition-colors',
                form.requires_otp && 'border-primary/30 bg-primary/5',
              )}>
                <div>
                  <p className="text-sm font-medium">Verificación OTP</p>
                  <p className="text-xs text-muted-foreground">
                    {form.requires_otp
                      ? 'Recibirá un código SMS en cada inicio de sesión.'
                      : 'Sin verificación de dos pasos.'}
                  </p>
                </div>
                <Switch
                  checked={form.requires_otp}
                  onCheckedChange={(v) => {
                    setForm((f) => ({ ...f, requires_otp: v }));
                    if (errors.phone) setErrors((er) => ({ ...er, phone: undefined }));
                  }}
                  disabled={isSaving}
                />
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="gap-2">
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                {editing ? 'Guardar cambios' : 'Crear usuario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
