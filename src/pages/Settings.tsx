import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Settings as SettingsIcon, ShieldCheck, Users, FlaskConical } from 'lucide-react';
import { BudgetRulesTab } from '@/components/settings/BudgetRulesTab';
import { LaboratoriesTab } from '@/components/settings/LaboratoriesTab';
import { AppUsersSection } from '@/components/settings/AppUsersSection';
import { NotificationPreferencesTab } from '@/components/settings/NotificationPreferencesTab';
import { PageHeader } from '@/components/common/PageHeader';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('budget');
  const [tabErrors, setTabErrors] = useState<Record<string, boolean>>({});

  const handleBudgetError = useCallback(
    (hasError: boolean) => setTabErrors((prev) => ({ ...prev, budget: hasError })),
    [],
  );
  const handleLabsError = useCallback(
    (hasError: boolean) => setTabErrors((prev) => ({ ...prev, labs: hasError })),
    [],
  );
  const handleUsersError = useCallback(
    (hasError: boolean) => setTabErrors((prev) => ({ ...prev, users: hasError })),
    [],
  );

  const hasError = tabErrors[activeTab] ?? false;

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 sm:space-y-6">
      <PageHeader
        icon={SettingsIcon}
        title="Configuración"
        description="Controla las reglas financieras y accesos del sistema"
        muted={hasError}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="budget" className="flex-col gap-0.5 py-2 sm:flex-row sm:gap-1.5 sm:py-1.5 text-xs sm:text-sm">
            <ShieldCheck className="size-4 shrink-0" />
            <span className="text-[10px] leading-tight sm:text-sm sm:leading-normal truncate">
              <span className="sm:hidden">Presupuesto</span>
              <span className="hidden sm:inline">Reglas de Presupuesto</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="labs" className="flex-col gap-0.5 py-2 sm:flex-row sm:gap-1.5 sm:py-1.5 text-xs sm:text-sm">
            <FlaskConical className="size-4 shrink-0" />
            <span className="text-[10px] leading-tight sm:text-sm sm:leading-normal truncate">
              <span className="sm:hidden">Labs</span>
              <span className="hidden sm:inline">Laboratorios</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex-col gap-0.5 py-2 sm:flex-row sm:gap-1.5 sm:py-1.5 text-xs sm:text-sm">
            <Users className="size-4 shrink-0" />
            <span className="text-[10px] leading-tight sm:text-sm sm:leading-normal truncate">
              <span className="sm:hidden">Usuarios</span>
              <span className="hidden sm:inline">Usuarios y Accesos</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-col gap-0.5 py-2 sm:flex-row sm:gap-1.5 sm:py-1.5 text-xs sm:text-sm">
            <Bell className="size-4 shrink-0" />
            <span className="text-[10px] leading-tight sm:text-sm sm:leading-normal truncate">
              <span className="sm:hidden">Alertas</span>
              <span className="hidden sm:inline">Notificaciones</span>
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="budget" className="space-y-6">
          <BudgetRulesTab onError={handleBudgetError} />
        </TabsContent>

        <TabsContent value="labs">
          <LaboratoriesTab onError={handleLabsError} />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <AppUsersSection onError={handleUsersError} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationPreferencesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
