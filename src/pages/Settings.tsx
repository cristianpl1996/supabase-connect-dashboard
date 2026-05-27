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

  const makeErrorHandler = useCallback(
    (tab: string) => (hasError: boolean) =>
      setTabErrors((prev) => ({ ...prev, [tab]: hasError })),
    []
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
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="budget" className="gap-1.5 text-xs sm:text-sm">
            <ShieldCheck className="size-4 shrink-0" />
            <span className="hidden sm:inline truncate">Reglas de Presupuesto</span>
            <span className="sm:hidden truncate">Presupuesto</span>
          </TabsTrigger>
          <TabsTrigger value="labs" className="gap-1.5 text-xs sm:text-sm">
            <FlaskConical className="size-4 shrink-0" />
            <span className="truncate">Laboratorios</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5 text-xs sm:text-sm">
            <Users className="size-4 shrink-0" />
            <span className="hidden sm:inline truncate">Usuarios y Accesos</span>
            <span className="sm:hidden truncate">Usuarios</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs sm:text-sm">
            <Bell className="size-4 shrink-0" />
            <span className="truncate">Notificaciones</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="budget" className="space-y-6">
          <BudgetRulesTab onError={makeErrorHandler('budget')} />
        </TabsContent>

        <TabsContent value="labs">
          <LaboratoriesTab onError={makeErrorHandler('labs')} />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <AppUsersSection onError={makeErrorHandler('users')} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationPreferencesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
