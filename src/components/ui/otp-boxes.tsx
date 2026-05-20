import { useRef } from "react";

export function OtpBoxes({ value, onChange, onComplete }: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (code: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const focus = (i: number) => refs.current[i]?.focus();

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const arr = [...digits];
    arr[i] = digit;
    const next = arr.join("");
    onChange(next);
    if (digit && i < 5) focus(i + 1);
    if (arr.every(d => d !== "")) onComplete?.(next);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i]) { const arr = [...digits]; arr[i] = ""; onChange(arr.join("")); }
      else if (i > 0) { focus(i - 1); }
    } else if (e.key === "ArrowLeft" && i > 0) { focus(i - 1); }
    else if (e.key === "ArrowRight" && i < 5) { focus(i + 1); }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted);
      focus(Math.min(pasted.length, 5));
      if (pasted.length === 6) onComplete?.(pasted);
    }
    e.preventDefault();
  };

  const box = (i: number) => (
    <input
      key={i}
      ref={el => { refs.current[i] = el; }}
      type="text"
      inputMode="numeric"
      maxLength={2}
      value={digits[i]}
      onChange={e => handleChange(i, e.target.value)}
      onKeyDown={e => handleKeyDown(i, e)}
      onPaste={handlePaste}
      onFocus={e => {
        e.target.select();
        e.target.style.borderColor = "#16a34a";
        e.target.style.boxShadow = "0 0 0 3px rgba(22,163,74,0.18)";
        e.target.style.backgroundColor = "#fff";
      }}
      onBlur={e => {
        e.target.style.borderColor = digits[i] ? "#16a34a" : "#d1d5db";
        e.target.style.boxShadow = "none";
        e.target.style.backgroundColor = digits[i] ? "#f0fdf4" : "#f9fafb";
      }}
      style={{
        width: 48, height: 58, textAlign: "center",
        fontSize: "1.5rem", fontWeight: 700,
        color: "#111827",
        backgroundColor: digits[i] ? "#f0fdf4" : "#f9fafb",
        border: `2px solid ${digits[i] ? "#16a34a" : "#d1d5db"}`,
        borderRadius: 12, outline: "2px solid transparent", outlineOffset: 2, caretColor: "transparent",
        transition: "border-color 0.15s, box-shadow 0.15s, background-color 0.15s",
      }}
    />
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {[0, 1, 2].map(box)}
      <span style={{ color: "#d1d5db", fontSize: "1.4rem", fontWeight: 300, userSelect: "none" }}>—</span>
      {[3, 4, 5].map(box)}
    </div>
  );
}
