import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Database, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const SQL_SETUP = `-- Ejecutar en Supabase SQL Editor para habilitar el portal de representantes
-- Ver instrucciones completas en /database-setup

-- Crear tabla de perfiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  laboratory_id UUID REFERENCES public.laboratories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear enum y tabla de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'representative');

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'representative',
  UNIQUE (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
`;

const Settings = () => {
  const { profile, role, isAdmin } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SQL_SETUP);
    setCopied(true);
    toast.success("SQL copiado");
    setTimeout(() => setCopied(false), 2000);
  };

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
            Mi Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p className="font-medium">{profile?.full_name || 'No configurado'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rol</p>
              <p className="font-medium capitalize">{role || 'No asignado'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Laboratorio</p>
              <p className="font-medium">{profile?.laboratory_name || (isAdmin ? 'Todos (Admin)' : 'No asignado')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Configuración de Base de Datos
                </CardTitle>
                <CardDescription>
                  SQL para habilitar perfiles y roles
                </CardDescription>
              </div>
              <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2">
                {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 overflow-auto max-h-[200px]">
              <pre className="text-xs font-mono whitespace-pre-wrap">{SQL_SETUP}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settings;
