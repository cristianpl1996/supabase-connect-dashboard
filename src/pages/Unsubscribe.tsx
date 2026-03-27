import { useState } from "react";
import logoIvanagro from "@/assets/logoico.png";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MailX, CheckCircle2, XCircle } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const email = searchParams.get("mail") || "";
  const token = searchParams.get("token") || "";

  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleConfirm = async () => {
    if (!email || !token) {
      setErrorMsg("El enlace de darse de baja no es válido.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/unsubscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token, reason }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Error al procesar la solicitud.");
      }

      setStatus("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      setStatus("error");
    }
  };

  return (
    <div className="unsubscribe-root">
      {/* Background */}
      <div className="unsubscribe-bg" />

      {/* Card */}
      <main className="unsubscribe-main">
        <div className="unsubscribe-card-wrapper">
          {/* Logo centered above card */}
          <div className="unsubscribe-logo-wrap mb-4">
            <img src={logoIvanagro} alt="Ivanagro" className="unsubscribe-logo" />
          </div>

          <div className="unsubscribe-card mt-4">
            {/* Top accent */}
            <div className="unsubscribe-card-accent" />

            <div className="unsubscribe-card-body">
              {status === "success" ? (
                <SuccessState email={email} onHome={() => navigate("/")} />
              ) : status === "error" ? (
                <ErrorState message={errorMsg} onRetry={() => setStatus("idle")} />
              ) : (
                <FormState
                  email={email}
                  reason={reason}
                  loading={status === "loading"}
                  onReasonChange={setReason}
                  onConfirm={handleConfirm}
                  onCancel={() => navigate("/")}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="unsubscribe-footer">
        © {new Date().getFullYear()} Ivanagro · Todos los derechos reservados
      </footer>

      <style>{styles}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sub-components                                                        */
/* ------------------------------------------------------------------ */

interface FormStateProps {
  email: string;
  reason: string;
  loading: boolean;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const FormState = ({ email, reason, loading, onReasonChange, onConfirm, onCancel }: FormStateProps) => (
  <>
    <div className="unsubscribe-icon-wrap">
      <MailX size={36} strokeWidth={1.5} />
    </div>
    <h1 className="unsubscribe-title">Darse de baja</h1>
    <p className="unsubscribe-desc">
      Lamentamos que desees dejarnos. Si confirmas la baja, no volverás a
      recibir correos electrónicos de nuestras campañas y promociones.
    </p>
    {email && (
      <p className="unsubscribe-email-line">
        Correo:{" "}
        <a href={`mailto:${email}`} className="unsubscribe-email-link">
          {email}
        </a>
      </p>
    )}

    <label className="unsubscribe-label">
      ¿Deseas compartir el motivo?{" "}
      <span className="unsubscribe-optional">(Opcional)</span>
    </label>
    <textarea
      className="unsubscribe-textarea"
      placeholder="Cuéntanos por qué te vas..."
      value={reason}
      onChange={(e) => onReasonChange(e.target.value)}
      rows={4}
      disabled={loading}
    />

    <button
      className="unsubscribe-btn-primary"
      onClick={onConfirm}
      disabled={loading}
    >
      {loading ? "Procesando..." : "Confirmar baja"}
    </button>
    <button className="unsubscribe-btn-ghost" onClick={onCancel} disabled={loading}>
      Cancelar
    </button>
  </>
);

const SuccessState = ({ email, onHome }: { email: string; onHome: () => void }) => (
  <>
    <div className="unsubscribe-icon-wrap unsubscribe-icon-success">
      <CheckCircle2 size={40} strokeWidth={1.5} />
    </div>
    <h1 className="unsubscribe-title">¡Baja confirmada!</h1>
    <p className="unsubscribe-desc">
      El correo <strong>{email}</strong> ha sido eliminado de nuestra lista. Ya
      no recibirás más correos de nuestras campañas.
    </p>
    <button className="unsubscribe-btn-primary" onClick={onHome}>
      Volver al inicio
    </button>
  </>
);

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <>
    <div className="unsubscribe-icon-wrap unsubscribe-icon-error">
      <XCircle size={40} strokeWidth={1.5} />
    </div>
    <h1 className="unsubscribe-title">Algo salió mal</h1>
    <p className="unsubscribe-desc">{message}</p>
    <button className="unsubscribe-btn-primary" onClick={onRetry}>
      Intentar de nuevo
    </button>
  </>
);

/* ------------------------------------------------------------------ */
/* Styles (scoped via prefixed class names)                             */
/* ------------------------------------------------------------------ */

const styles = `
  /* Root */
  .unsubscribe-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    background: #f0f7f0;
    font-family: Roboto, system-ui, sans-serif;
  }

  /* Decorative background blobs */
  .unsubscribe-bg {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse 60% 50% at 15% 20%, hsla(145, 60%, 80%, 0.35) 0%, transparent 70%),
      radial-gradient(ellipse 50% 55% at 85% 75%, hsla(145, 70%, 70%, 0.25) 0%, transparent 70%),
      #f0f7f0;
    z-index: 0;
  }

  /* Logo above card */
  .unsubscribe-card-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 480px;
  }

  .unsubscribe-logo-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .unsubscribe-logo {
    height: 80px;
    width: auto;
    object-fit: contain;
    display: block;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.12));
  }

  /* Main */
  .unsubscribe-main {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    width: 100%;
  }

  /* Card */
  .unsubscribe-card {
    background: #ffffff;
    border-radius: 1.25rem;
    box-shadow:
      0 4px 6px -1px rgba(0,0,0,0.07),
      0 20px 60px -10px rgba(0, 100, 30, 0.12);
    width: 100%;
    overflow: hidden;
    border: 1px solid hsla(145, 50%, 85%, 0.6);
  }

  .unsubscribe-card-accent {
    height: 4px;
    background: linear-gradient(90deg, hsl(145, 93%, 28%) 0%, hsl(160, 80%, 45%) 100%);
  }

  .unsubscribe-card-body {
    padding: 2.25rem 2rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  /* Icon */
  .unsubscribe-icon-wrap {
    width: 70px;
    height: 70px;
    border-radius: 50%;
    background: hsla(145, 70%, 92%, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: hsl(145, 93%, 28%);
    margin-bottom: 0.5rem;
  }

  .unsubscribe-icon-success {
    background: hsla(145, 70%, 92%, 1);
    color: hsl(145, 93%, 28%);
  }

  .unsubscribe-icon-error {
    background: hsla(0, 80%, 95%, 1);
    color: hsl(0, 72%, 51%);
  }

  /* Text */
  .unsubscribe-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: hsl(145, 60%, 18%);
    text-align: center;
    margin: 0.5rem 0 0;
  }

  .unsubscribe-desc {
    font-size: 0.925rem;
    color: #555;
    text-align: center;
    line-height: 1.6;
    margin: 0.5rem 0;
    max-width: 360px;
  }

  .unsubscribe-email-line {
    font-size: 0.875rem;
    color: #555;
    margin: 0.25rem 0 0.75rem;
    text-align: center;
  }

  .unsubscribe-email-link {
    color: hsl(145, 93%, 28%);
    font-weight: 500;
    text-decoration: none;
  }

  .unsubscribe-email-link:hover {
    text-decoration: underline;
  }

  /* Form */
  .unsubscribe-label {
    width: 100%;
    font-size: 0.875rem;
    font-weight: 500;
    color: #333;
    margin-top: 0.5rem;
  }

  .unsubscribe-optional {
    color: #888;
    font-weight: 400;
  }

  .unsubscribe-textarea {
    width: 100%;
    border: 1.5px solid hsl(145, 30%, 82%);
    border-radius: 0.625rem;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: #333;
    resize: vertical;
    outline: none;
    background: #fafafa;
    transition: border-color 0.2s;
    margin-top: 0.35rem;
    box-sizing: border-box;
  }

  .unsubscribe-textarea:focus {
    border-color: hsl(145, 93%, 28%);
    background: #fff;
    box-shadow: 0 0 0 3px hsla(145, 70%, 50%, 0.15);
  }

  .unsubscribe-textarea:disabled {
    opacity: 0.6;
  }

  /* Buttons */
  .unsubscribe-btn-primary {
    width: 100%;
    padding: 0.85rem 1.5rem;
    border-radius: 0.625rem;
    border: none;
    background: linear-gradient(135deg, hsl(145, 93%, 28%) 0%, hsl(155, 80%, 35%) 100%);
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
    margin-top: 0.75rem;
    box-shadow: 0 4px 14px hsla(145, 80%, 25%, 0.3);
    letter-spacing: 0.01em;
  }

  .unsubscribe-btn-primary:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 6px 18px hsla(145, 80%, 25%, 0.38);
  }

  .unsubscribe-btn-primary:active:not(:disabled) {
    transform: translateY(0);
  }

  .unsubscribe-btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .unsubscribe-btn-ghost {
    background: none;
    border: none;
    color: #888;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0.5rem;
    transition: color 0.2s;
    margin-top: 0.1rem;
  }

  .unsubscribe-btn-ghost:hover:not(:disabled) {
    color: #444;
  }

  /* Footer */
  .unsubscribe-footer {
    position: relative;
    z-index: 1;
    padding: 1.25rem 2rem;
    font-size: 0.8rem;
    color: #8aaa8a;
    text-align: center;
  }

  /* Responsive */
  @media (max-width: 520px) {
    .unsubscribe-card-body {
      padding: 1.75rem 1.25rem 1.5rem;
    }
  }
`;

export default Unsubscribe;
