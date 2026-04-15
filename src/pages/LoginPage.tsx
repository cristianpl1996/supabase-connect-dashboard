import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import logoIco from "@/assets/logoico.png";
import bgImage from "@/assets/background.png";

const schema = z.object({
  username: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/home";

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values);
      toast.success("Inicio de sesión exitoso", {
        description: "Bienvenido al backoffice de Ivanagro.",
        duration: 3000,
        style: {
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          color: "#15803d",
        },
      });
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(
        err instanceof ApiError
          ? "Credenciales no válidas"
          : "Error de conexión. Verifica tu internet e intenta de nuevo."
      );
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — background + animated shapes ─────────────────────── */}
      <style>{`
        @keyframes float-slow   { 0%,100%{transform:translateY(0) scale(1)}   50%{transform:translateY(-28px) scale(1.04)} }
        @keyframes float-medium { 0%,100%{transform:translateY(0) scale(1)}   50%{transform:translateY(-18px) scale(1.06)} }
        @keyframes float-fast   { 0%,100%{transform:translateY(0) scale(1)}   50%{transform:translateY(-12px) scale(1.03)} }
        @keyframes drift-x      { 0%,100%{transform:translateX(0)}            50%{transform:translateX(22px)} }
        @keyframes spin-slow    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse-soft   { 0%,100%{opacity:.18} 50%{opacity:.32} }
        @keyframes morph        {
          0%,100%{border-radius:60% 40% 30% 70% / 60% 30% 70% 40%}
          25%    {border-radius:30% 60% 70% 40% / 50% 60% 30% 60%}
          50%    {border-radius:50% 60% 30% 60% / 30% 40% 70% 60%}
          75%    {border-radius:60% 30% 60% 40% / 70% 50% 40% 50%}
        }
      `}</style>

      <div
        className="hidden lg:block lg:w-[55%] relative overflow-hidden"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(150deg, rgba(2,44,34,0.78) 0%, rgba(21,128,61,0.52) 45%, rgba(0,0,0,0.80) 100%)",
        }} />

        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)",
          backgroundSize: "36px 36px",
        }} />

        {/* Orb 1 — large top-left, slow float */}
        <div style={{
          position:"absolute", top:"-80px", left:"-80px",
          width:"420px", height:"420px", borderRadius:"50%",
          background:"radial-gradient(circle at 40% 40%, rgba(74,222,128,0.25), rgba(21,128,61,0.08))",
          filter:"blur(48px)",
          animation:"float-slow 9s ease-in-out infinite",
        }} />

        {/* Orb 2 — medium right, medium float + drift */}
        <div style={{
          position:"absolute", top:"30%", right:"-100px",
          width:"360px", height:"360px", borderRadius:"50%",
          background:"radial-gradient(circle at 60% 60%, rgba(167,243,208,0.20), rgba(6,78,59,0.06))",
          filter:"blur(56px)",
          animation:"float-medium 7s ease-in-out infinite, drift-x 11s ease-in-out infinite",
        }} />

        {/* Orb 3 — small bottom center */}
        <div style={{
          position:"absolute", bottom:"-60px", left:"35%",
          width:"280px", height:"280px", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(52,211,153,0.22), transparent 70%)",
          filter:"blur(40px)",
          animation:"float-fast 6s ease-in-out infinite",
        }} />

        {/* Orb 4 — accent mid-left */}
        <div style={{
          position:"absolute", top:"55%", left:"5%",
          width:"180px", height:"180px", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(110,231,183,0.18), transparent 70%)",
          filter:"blur(32px)",
          animation:"float-slow 10s ease-in-out infinite 2s",
        }} />

        {/* Morphing shape — center */}
        <div style={{
          position:"absolute", top:"22%", left:"18%",
          width:"220px", height:"220px",
          background:"rgba(255,255,255,0.04)",
          border:"1px solid rgba(255,255,255,0.10)",
          backdropFilter:"blur(2px)",
          animation:"morph 14s ease-in-out infinite, pulse-soft 8s ease-in-out infinite",
        }} />

        {/* Spinning ring — top right */}
        <div style={{
          position:"absolute", top:"8%", right:"12%",
          width:"140px", height:"140px", borderRadius:"50%",
          border:"1.5px solid rgba(255,255,255,0.12)",
          animation:"spin-slow 20s linear infinite",
        }}>
          {/* inner dot */}
          <div style={{
            position:"absolute", top:"10px", left:"50%", transform:"translateX(-50%)",
            width:"6px", height:"6px", borderRadius:"50%",
            background:"rgba(255,255,255,0.5)",
          }} />
        </div>

        {/* Small ring — bottom left */}
        <div style={{
          position:"absolute", bottom:"15%", left:"10%",
          width:"80px", height:"80px", borderRadius:"50%",
          border:"1px solid rgba(255,255,255,0.15)",
          animation:"spin-slow 14s linear infinite reverse",
        }} />

        {/* Floating particles */}
        {[
          { top:"15%",  left:"60%",  size:6,  delay:"0s",   dur:"5s"  },
          { top:"42%",  left:"25%",  size:4,  delay:"1.5s", dur:"6s"  },
          { top:"68%",  left:"72%",  size:5,  delay:"3s",   dur:"7s"  },
          { top:"80%",  left:"40%",  size:3,  delay:"0.8s", dur:"5.5s"},
          { top:"30%",  left:"80%",  size:4,  delay:"2s",   dur:"8s"  },
        ].map((p, i) => (
          <div key={i} style={{
            position:"absolute", top:p.top, left:p.left,
            width:`${p.size}px`, height:`${p.size}px`, borderRadius:"50%",
            background:"rgba(255,255,255,0.55)",
            boxShadow:"0 0 6px 2px rgba(255,255,255,0.25)",
            animation:`float-slow ${p.dur} ease-in-out infinite ${p.delay}`,
          }} />
        ))}
      </div>

      {/* ── Right panel — form ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-10 bg-gray-50">
        <div className="w-full max-w-[420px]">

          {/* Logo above card */}
          <div className="flex flex-col items-center mb-8">
            <img src={logoIco} alt="Ivanagro" className="h-24 w-auto object-contain drop-shadow-sm" />
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg px-9 py-9 space-y-6">

            <div className="space-y-1.5 text-center">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Iniciar sesión</h2>
              <p className="text-sm text-gray-500">Accede a tu plataforma de gestión comercial</p>
            </div>

            {serverError && (
              <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span className="font-medium">{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-semibold text-gray-700">
                  Usuario
                </Label>
                <Input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  placeholder="Ej: carlos.martinez"
                  className="h-11 text-sm rounded-xl border-gray-300 bg-white placeholder:text-gray-400 focus-visible:ring-primary"
                  {...register("username")}
                />
                {errors.username && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <span>•</span>{errors.username.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Ingresa tu contraseña"
                    className="h-11 pr-11 text-sm rounded-xl border-gray-300 bg-white placeholder:text-gray-400 focus-visible:ring-primary"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <span>•</span>{errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-sm font-semibold rounded-xl"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando…</>
                  : "Ingresar"
                }
              </Button>

            </form>
          </div>

          {/* Footer links */}
          <div className="flex items-center justify-center gap-1.5 mt-5 text-xs text-gray-400">
            <span
              title="Contacta al administrador del sistema"
              className="cursor-pointer transition-colors hover:text-primary hover:font-semibold"
            >
              ¿Problemas para ingresar?
            </span>
            <span className="cursor-pointer transition-colors hover:text-primary hover:font-semibold">
              Contáctanos
            </span>
          </div>

          <p className="text-center text-[11px] text-gray-400 mt-3">
            © {new Date().getFullYear()} Ivanagro · Hubu
          </p>

        </div>
      </div>
    </div>
  );
}
