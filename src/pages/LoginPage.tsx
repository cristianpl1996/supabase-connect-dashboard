import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, verifyOtp } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpBoxes } from "@/components/ui/otp-boxes";
import { Eye, EyeOff, Loader2, AlertCircle, User, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import logoIco from "@/assets/logoico.png";
import bgImage from "@/assets/background.png";


const schema = z.object({
  username: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login, finalizeOtpLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/home";

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // OTP state
  const [otpStep, setOtpStep] = useState(false);
  const otpTokenRef = useRef("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const otpAttemptsRef = useRef(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const pendingCredentialsRef = useRef<{ username: string; password: string } | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);


  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");

    root.classList.remove("dark");
    root.classList.add("light");

    return () => {
      root.classList.remove("light");
      if (hadDark) root.classList.add("dark");
    };
  }, []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const result = await login({ username: values.username, password: values.password });
      if (result?.otp_required && "otp_token" in result) {
        otpTokenRef.current = result.otp_token;
        setOtpStep(true);
        otpAttemptsRef.current = 0;
        setResendCooldown(60);
        setPhoneHint(result.phone_hint ?? null);
        pendingCredentialsRef.current = { username: values.username, password: values.password };
        toast.success("Código enviado", {
          description: "Se envió un código de 6 dígitos a tu teléfono registrado.",
          duration: 4000,
        });
      } else {
        toast.success("Inicio de sesión exitoso", {
          description: "Bienvenido al backoffice de Ivanagro.",
          duration: 3000,
        });
        navigate(from, { replace: true });
      }
    } catch (err) {
      setServerError(
        err instanceof ApiError
          ? "Credenciales no válidas"
          : "Error de conexión. Verifica tu internet e intenta de nuevo."
      );
    }
  };

  const onVerifyOtp = async (codeOverride?: string) => {
    const code = codeOverride ?? otpCode;
    if (code.length !== 6) return;
    setOtpError(null);
    setOtpLoading(true);
    try {
      const res = await verifyOtp({ otp_token: otpTokenRef.current, code });
      finalizeOtpLogin(res.access_token, res.user);
      toast.success("Código verificado", {
        description: "Bienvenido al backoffice de Ivanagro.",
        duration: 3000,
      });
      navigate(from, { replace: true });
    } catch (err) {
      const newAttempts = otpAttemptsRef.current + 1;
      otpAttemptsRef.current = newAttempts;
      if (newAttempts >= 3) {
        toast.error("Demasiados intentos fallidos", {
          description: "Por seguridad, debes iniciar sesión nuevamente.",
          duration: 4000,
        });
        setOtpStep(false);
        setOtpCode("");
        setOtpError(null);
        otpAttemptsRef.current = 0;
        setResendCooldown(0);
      } else {
        setOtpError(
          err instanceof ApiError ? err.message : "Código incorrecto. Intenta de nuevo."
        );
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingCredentialsRef.current || resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setOtpError(null);
    try {
      const result = await login(pendingCredentialsRef.current);
      if (result?.otp_required && "otp_token" in result) {
        otpTokenRef.current = result.otp_token;
        setOtpCode("");
        setResendCooldown(60);
        toast.success("Código reenviado", {
          description: "Se envió un nuevo código a tu teléfono.",
          duration: 3000,
        });
      }
    } catch {
      toast.error("No se pudo reenviar el código. Intenta de nuevo.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="light min-h-screen flex bg-gray-50 text-gray-900">

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
        .login-light-scope input {
          background-color: #ffffff !important;
          color: #111827 !important;
          border-color: #d1d5db !important;
          caret-color: #111827;
          box-shadow: none;
        }
        .login-light-scope input::placeholder {
          color: #9ca3af !important;
          opacity: 1;
        }
        .login-light-scope input:focus,
        .login-light-scope input:focus-visible {
          background-color: #ffffff !important;
          color: #111827 !important;
          border-color: #16a34a !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.16) !important;
        }
        .login-light-scope input:-webkit-autofill,
        .login-light-scope input:-webkit-autofill:hover,
        .login-light-scope input:-webkit-autofill:focus,
        .login-light-scope input:-webkit-autofill:active {
          -webkit-text-fill-color: #111827 !important;
          caret-color: #111827 !important;
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          box-shadow: 0 0 0 1000px #ffffff inset !important;
          transition: background-color 9999s ease-out;
        }
        @keyframes slide-up { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .login-card-animate { animation: slide-up 0.5s ease-out both; }
        .login-card-animate-delay { animation: slide-up 0.5s ease-out 0.1s both; }
        .input-icon-wrapper { position:relative; }
        .input-icon-wrapper .input-icon-left {
          position:absolute; left:13px; top:50%; transform:translateY(-50%);
          color:#9ca3af; pointer-events:none; z-index:1;
        }
        .input-icon-wrapper input { padding-left: 40px !important; }
        .login-btn-arrow { transition: transform 0.2s ease; }
        .login-light-scope button[type=submit]:not(:disabled):hover .login-btn-arrow { transform: translateX(4px); }
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

        {/* Orb 1 */}
        <div style={{
          position: "absolute", top: "-80px", left: "-80px",
          width: "420px", height: "420px", borderRadius: "50%",
          background: "radial-gradient(circle at 40% 40%, rgba(74,222,128,0.25), rgba(21,128,61,0.08))",
          filter: "blur(48px)",
          animation: "float-slow 9s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "30%", right: "-100px",
          width: "360px", height: "360px", borderRadius: "50%",
          background: "radial-gradient(circle at 60% 60%, rgba(167,243,208,0.20), rgba(6,78,59,0.06))",
          filter: "blur(56px)",
          animation: "float-medium 7s ease-in-out infinite, drift-x 11s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-60px", left: "35%",
          width: "280px", height: "280px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(52,211,153,0.22), transparent 70%)",
          filter: "blur(40px)",
          animation: "float-fast 6s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "22%", left: "18%",
          width: "220px", height: "220px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(2px)",
          animation: "morph 14s ease-in-out infinite, pulse-soft 8s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "8%", right: "12%",
          width: "140px", height: "140px", borderRadius: "50%",
          border: "1.5px solid rgba(255,255,255,0.12)",
          animation: "spin-slow 20s linear infinite",
        }}>
          <div style={{
            position: "absolute", top: "10px", left: "50%", transform: "translateX(-50%)",
            width: "6px", height: "6px", borderRadius: "50%",
            background: "rgba(255,255,255,0.5)",
          }} />
        </div>
        {[
          { top: "15%", left: "60%", size: 6, delay: "0s", dur: "5s" },
          { top: "42%", left: "25%", size: 4, delay: "1.5s", dur: "6s" },
          { top: "68%", left: "72%", size: 5, delay: "3s", dur: "7s" },
          { top: "80%", left: "40%", size: 3, delay: "0.8s", dur: "5.5s" },
          { top: "30%", left: "80%", size: 4, delay: "2s", dur: "8s" },
        ].map((p) => (
          <div key={`${p.top}-${p.left}-${p.delay}`} style={{
            position: "absolute", top: p.top, left: p.left,
            width: `${p.size}px`, height: `${p.size}px`, borderRadius: "50%",
            background: "rgba(255,255,255,0.55)",
            boxShadow: "0 0 6px 2px rgba(255,255,255,0.25)",
            animation: `float-slow ${p.dur} ease-in-out infinite ${p.delay}`,
          }} />
        ))}
      </div>

      {/* ── Right panel — form ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-10 bg-gray-50">
        <div className="w-full max-w-[420px]">

          {/* Logo above card */}
          <div className="flex flex-col items-center mb-5 sm:mb-8">
            <img src={logoIco} alt="Ivanagro" className="h-16 sm:h-24 w-auto object-contain drop-shadow-sm" />
          </div>

          {/* Card */}
          <div className="login-card-animate bg-white rounded-2xl border border-gray-200 shadow-xl px-5 py-7 sm:px-9 sm:py-9 space-y-6"
            style={{ boxShadow: "0 4px 32px 0 rgba(10,150,63,0.08), 0 1.5px 8px 0 rgba(0,0,0,0.06)" }}>

            {!otpStep ? (
              <div className="login-light-scope space-y-6">
                {/* ── Step 1: credentials ─────────────────────────────── */}
                <div className="flex flex-col items-center gap-3">
                  <div className="text-center space-y-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Iniciar sesión</h2>
                    <p className="text-sm text-gray-500">Accede a tu plataforma de gestión comercial</p>
                  </div>
                </div>

                {serverError && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="size-4 shrink-0 text-red-500" />
                    <span className="font-medium">{serverError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/10">
                        <User className="size-5" />
                      </span>
                      Usuario
                    </Label>
                    <Input
                      id="username"
                      autoComplete="username"
                      autoFocus
                      placeholder="Ej: carlos.martinez"
                      className="h-11 text-sm rounded-xl border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.16)] focus-visible:border-[#16a34a]"
                      {...register("username")}
                    />
                    {errors.username && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="size-3" />{errors.username.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/10">
                        <Lock className="size-5" />
                      </span>
                      Contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Ingresa tu contraseña"
                        className="h-11 pr-11 text-sm rounded-xl border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.16)] focus-visible:border-[#16a34a]"
                        {...register("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        tabIndex={-1}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="size-3" />{errors.password.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-xl text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#0a963f]/30 focus-visible:ring-offset-2 disabled:opacity-60 disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2"
                    style={{ background: isSubmitting ? undefined : "linear-gradient(135deg, #0a963f 0%, #16a34a 100%)" }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : ""}
                    Iniciar sesión
                  </Button>
                </form>
                <div className="mt-6 grid gap-3 border-t pt-5 ">
                  <div className="mt-2 rounded-md border bg-background/75 p-3">
                    <p className="text-xs leading-5 text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="size-10 text-primary" /> Si tus credenciales no funcionan, contacta a través de nuestros canales de comunicación.
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-3 h-9 w-full gap-2 bg-background">
                      <a href="mailto:marketing@ivanagro.com">
                        <Mail className="size-4" />
                        Contactanos
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* ── Step 2: OTP verification ─────────────────────────── */}
                <div className="text-center space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Verificación OTP</h2>
                  <p className="text-sm text-gray-500">
                    Ingresa el código de 6 dígitos enviado al número
                    {phoneHint && <span className="font-semibold text-gray-700"> *****{phoneHint.slice(-4)}</span>}
                  </p>
                </div>

                {otpError && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="size-4 shrink-0 text-red-500" />
                    <span className="font-medium">{otpError}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex flex-col items-center gap-3">
                    <OtpBoxes value={otpCode} onChange={setOtpCode} onComplete={(code) => onVerifyOtp(code)} />
                    <p className="text-xs text-gray-400">El código expira en unos minutos</p>
                  </div>

                  <Button
                    onClick={() => onVerifyOtp()}
                    disabled={otpCode.length !== 6 || otpLoading}
                    className="h-12 w-full rounded-xl text-sm font-semibold text-white shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #0a963f 0%, #16a34a 100%)" }}
                  >
                    {otpLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                    Verificar código
                  </Button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || resendLoading}
                    className={`w-full text-center text-sm font-semibold rounded-xl py-2.5 transition-colors border disabled:cursor-not-allowed ${resendCooldown > 0 || resendLoading
                      ? "border-gray-300 text-gray-400 opacity-50"
                      : "border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a]/5"
                      }`}
                  >
                    {resendLoading
                      ? "Reenviando…"
                      : resendCooldown > 0
                        ? `Reenviar código (${resendCooldown}s)`
                        : "Reenviar código"}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setOtpStep(false); setOtpCode(""); setOtpError(null); otpAttemptsRef.current = 0; setResendCooldown(0); }}
                    className="w-full text-center text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 rounded-xl py-2.5 transition-colors"
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              </>
            )}
          </div>

          <p className="text-center text-[12px] text-gray-400 mt-5">
            © {new Date().getFullYear()} Ivanagro · Hubu
          </p>

        </div>
      </div>
    </div>
  );
}
