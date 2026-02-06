import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings as SettingsIcon, ShieldCheck, Users, Plus, Trash2, Info, Loader2 } from 'lucide-react';
import { useBudgetRules } from '@/hooks/useBudgetRules';
import { toast } from 'sonner';

interface InvitedUser {
  id: string;
  email: string;
  role: 'admin' | 'viewer';
}

const Settings = () => {
  const { rules, config, isLoading, toggleRule } = useBudgetRules();

  // Users tab state
  const [users, setUsers] = useState<InvitedUser[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'viewer'>('viewer');

  const handleAddUser = () => {
    const trimmed = newEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Ingresa un correo electrónico válido');
      return;
    }
    if (users.some((u) => u.email === trimmed)) {
      toast.error('Este usuario ya fue invitado');
      return;
    }
    setUsers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), email: trimmed, role: newRole },
    ]);
    setNewEmail('');
    toast.success(`Usuario ${trimmed} invitado como ${newRole === 'admin' ? 'Admin' : 'Viewer'}`);
  };

  const handleRemoveUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    toast.success('Usuario removido');
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="budget" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Reglas de Presupuesto
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

        {/* ==================== TAB 2: Users & Access ==================== */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Gestión de Usuarios
              </CardTitle>
              <CardDescription>
                Invita usuarios por correo electrónico y asigna permisos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Invite Form */}
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="invite-email">Correo Electrónico</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="usuario@empresa.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
                  />
                </div>
                <div className="w-36 space-y-2">
                  <Label>Rol</Label>
                  <Select
                    value={newRole}
                    onValueChange={(v) => setNewRole(v as 'admin' | 'viewer')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddUser} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Invitar
                </Button>
              </div>

              {/* Users Table */}
              {users.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No hay usuarios invitados</p>
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
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant={user.role === 'admin' ? 'default' : 'secondary'}
                          >
                            {user.role === 'admin' ? 'Admin' : 'Viewer'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            Pendiente
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveUser(user.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
