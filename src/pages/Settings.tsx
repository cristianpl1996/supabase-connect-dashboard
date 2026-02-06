import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings as SettingsIcon, ShieldCheck, Users, Plus, Trash2, Info, Loader2, FlaskConical } from 'lucide-react';
import { useBudgetRules } from '@/hooks/useBudgetRules';
import { LaboratoriesTab } from '@/components/settings/LaboratoriesTab';
import { UserFormDialog } from '@/components/settings/UserFormDialog';
import { useUsers, type UserRole } from '@/hooks/useUsers';
import { toast } from 'sonner';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  sales_rep: 'Sales Rep',
  promotor: 'Promotor',
};

const Settings = () => {
  const { rules, config, isLoading, toggleRule } = useBudgetRules();
  const { users, isLoading: usersLoading, refetch: refetchUsers, deleteUser } = useUsers();

  const [userFormOpen, setUserFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleUserCreated = () => {
    refetchUsers();
  };

  const handleRemoveUser = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteUser(id);
      toast.success('Usuario eliminado');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al eliminar: ${message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleRule = async (conceptKey: string) => {
    await toggleRule(conceptKey);
    toast.success('Regla actualizada');
  };

  const spendableCount = Object.values(config).filter(Boolean).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configuración</h1>
          <p className="text-muted-foreground">
            Controla las reglas financieras y accesos del sistema
          </p>
        </div>
      </div>

      <Tabs defaultValue="budget" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="budget" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Reglas de Presupuesto
          </TabsTrigger>
          <TabsTrigger value="labs" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Laboratorios
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Usuarios y Accesos
          </TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: Budget Rules ==================== */}
        <TabsContent value="budget" className="space-y-6">
          {/* Info Banner */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-start gap-3 pt-6">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  ¿Qué es "Presupuesto Gastable"?
                </p>
                <p className="text-sm text-muted-foreground">
                  Define qué conceptos del acuerdo con el laboratorio pueden usarse para financiar promociones.
                  Los conceptos marcados como <strong>NO gastables</strong> (ej: Rebates, Descuentos Financieros)
                  se registran como dato informativo pero <strong>no suman al saldo disponible</strong> para crear promociones.
                  Esto protege el margen del distribuidor.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Rules Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Conceptos del Plan Anual
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {spendableCount} de {rules.length} conceptos marcados como gastables
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Cargando reglas...</span>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {rules.map((rule) => {
                    const isActive = config[rule.concept_key] ?? false;
                    return (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                      >
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={rule.concept_key}
                              className="text-base font-medium cursor-pointer"
                            >
                              {rule.label}
                            </Label>
                            <Badge
                              variant={isActive ? 'default' : 'outline'}
                              className={
                                isActive
                                  ? 'bg-primary/10 text-primary border-primary/20'
                                  : 'text-muted-foreground'
                              }
                            >
                              {isActive ? 'Gastable' : 'Informativo'}
                            </Badge>
                          </div>
                        </div>
                        <Switch
                          id={rule.concept_key}
                          checked={isActive}
                          onCheckedChange={() => handleToggleRule(rule.concept_key)}
                          aria-label={`¿${rule.label} es presupuesto gastable?`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Impact Summary */}
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="flex items-start gap-3 pt-6">
              <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">Impacto en la Billetera</p>
                <p className="text-sm text-muted-foreground">
                  Solo los conceptos marcados como <strong>"Gastable"</strong> se sumarán
                  al saldo disponible en la Billetera. Si un concepto está apagado, su valor
                  aparecerá en el sistema como referencia pero <strong>no se podrá usar para
                  financiar promociones</strong>.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB 2: Laboratorios ==================== */}
        <TabsContent value="labs">
          <LaboratoriesTab />
        </TabsContent>

        {/* ==================== TAB 3: Users & Access ==================== */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Gestión de Usuarios
                  </CardTitle>
                  <CardDescription>
                    {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                <Button onClick={() => setUserFormOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Invitar Usuario
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Cargando usuarios…</span>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No hay usuarios registrados</p>
                  <p className="text-sm mt-1">
                    Invita a tu equipo para colaborar en la plataforma
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Correo</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Laboratorio / Cupo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.email}</p>
                            {user.full_name && (
                              <p className="text-xs text-muted-foreground">{user.full_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.role === 'admin' ? 'default' : user.role === 'promotor' ? 'outline' : 'secondary'}
                            className={user.role === 'promotor' ? 'border-primary/30 text-primary' : undefined}
                          >
                            {ROLE_LABELS[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.role === 'promotor' && user.laboratory_name ? (
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium">{user.laboratory_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                Cupo: ${(user.approval_limit ?? 0).toLocaleString()}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveUser(user.id)}
                            disabled={deletingId === user.id}
                            className="text-destructive hover:text-destructive"
                          >
                            {deletingId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* User Form Dialog */}
          <UserFormDialog
            open={userFormOpen}
            onOpenChange={setUserFormOpen}
            onUserCreated={handleUserCreated}
            existingEmails={users.map((u) => u.email)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
