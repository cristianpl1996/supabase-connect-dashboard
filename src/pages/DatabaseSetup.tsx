import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SQL_SETUP = `-- =====================================================
-- PORTAL DE REPRESENTANTES - SETUP SQL
-- Ejecutar en orden en tu Supabase Self-Hosted
-- =====================================================

-- 1. Crear tabla de perfiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  laboratory_id UUID REFERENCES public.laboratories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crear enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'representative');

-- 3. Crear tabla de roles de usuario (separada por seguridad)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'representative',
  UNIQUE (user_id, role)
);

-- 4. Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_plans ENABLE ROW LEVEL SECURITY;

-- 5. Función de seguridad para verificar roles (evita recursión)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 6. Función para obtener lab_id del usuario
CREATE OR REPLACE FUNCTION public.get_user_lab_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT laboratory_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- 7. Políticas RLS para profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 8. Políticas RLS para user_roles
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 9. Políticas RLS para promotions
DROP POLICY IF EXISTS "promotions_select" ON public.promotions;
DROP POLICY IF EXISTS "promotions_insert" ON public.promotions;
DROP POLICY IF EXISTS "promotions_update" ON public.promotions;
DROP POLICY IF EXISTS "promotions_delete" ON public.promotions;

CREATE POLICY "promotions_select"
  ON public.promotions FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR lab_id = public.get_user_lab_id(auth.uid())
  );

CREATE POLICY "promotions_insert"
  ON public.promotions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR lab_id = public.get_user_lab_id(auth.uid())
  );

CREATE POLICY "promotions_update"
  ON public.promotions FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (lab_id = public.get_user_lab_id(auth.uid()) AND status IN ('borrador', 'pendiente_aprobacion'))
  );

CREATE POLICY "promotions_delete"
  ON public.promotions FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (lab_id = public.get_user_lab_id(auth.uid()) AND status = 'borrador')
  );

-- 10. Políticas RLS para annual_plans
DROP POLICY IF EXISTS "annual_plans_select" ON public.annual_plans;

CREATE POLICY "annual_plans_select"
  ON public.annual_plans FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR lab_id = public.get_user_lab_id(auth.uid())
  );

-- 11. Agregar estado 'pendiente_aprobacion' si no existe
DO $$ 
BEGIN
  -- Check if the status column uses an enum and add the value if needed
  -- This is a safe operation that won't fail if value exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'pendiente_aprobacion' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'promo_status')
  ) THEN
    ALTER TYPE promo_status ADD VALUE IF NOT EXISTS 'pendiente_aprobacion';
  END IF;
EXCEPTION
  WHEN others THEN
    -- If promo_status is not an enum, we assume status is TEXT and this works fine
    NULL;
END $$;

-- 12. Crear usuario admin inicial (ajusta el email)
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin' FROM auth.users WHERE email = 'sara@tuempresa.com';

-- =====================================================
-- FIN DEL SETUP
-- =====================================================
`;

const DatabaseSetup = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SQL_SETUP);
    setCopied(true);
    toast.success("SQL copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración de Base de Datos</h1>
        <p className="text-muted-foreground">
          Ejecuta este SQL en tu Supabase Self-Hosted para habilitar el portal de representantes
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle>SQL de Configuración</CardTitle>
            </div>
            <Button onClick={handleCopy} variant="outline" className="gap-2">
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar SQL
                </>
              )}
            </Button>
          </div>
          <CardDescription>
            Este script crea las tablas de perfiles, roles, y políticas RLS necesarias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 overflow-auto max-h-[500px]">
            <pre className="text-xs font-mono whitespace-pre-wrap">{SQL_SETUP}</pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pasos de Configuración</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              1
            </div>
            <div>
              <p className="font-medium">Ejecutar el SQL</p>
              <p className="text-sm text-muted-foreground">
                Copia el SQL de arriba y ejecútalo en el SQL Editor de tu Supabase
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              2
            </div>
            <div>
              <p className="font-medium">Crear Usuario Admin</p>
              <p className="text-sm text-muted-foreground">
                Registra un usuario con email de admin (ej: sara@empresa.com), luego ejecuta:<br/>
                <code className="bg-muted px-1 rounded">INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM auth.users WHERE email = 'sara@empresa.com';</code>
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              3
            </div>
            <div>
              <p className="font-medium">Desactivar Confirmación de Email (Opcional)</p>
              <p className="text-sm text-muted-foreground">
                En Authentication {'>'} Settings, desactiva "Confirm email" para pruebas más rápidas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseSetup;
