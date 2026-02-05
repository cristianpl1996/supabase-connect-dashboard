import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

const Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Administra las preferencias de tu cuenta y aplicación
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Próximamente
          </CardTitle>
          <CardDescription>
            Esta sección está en desarrollo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Aquí podrás configurar tu perfil, preferencias de notificaciones, 
            datos de la empresa y más.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
