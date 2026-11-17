import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { DEMO_ADMIN } from "../lib/demo";
import { useApp, useMeta } from "../lib/store";
import { ApiError } from "../lib/types";

export default function Account() {
  useMeta("Daxil ol və ya qeydiyyat", "AFN rent a car hesabı: rezervasiyalarınızı izləyin və ləğv edin.", { noindex: true });
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { setSession, demo, say } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    setErrors({});
    setBusy(true);
    try {
      const s = mode === "login" ? await api.login(f.email, f.password) : await api.register(f.name, f.email, f.password, f.phone || undefined);
      setSession(s);
      say(`Xoş gəldiniz, ${s.user.name}`);
      const next = params.get("next");
      nav(next && next.startsWith("/") && !next.startsWith("//") ? next : s.user.role === "admin" ? "/admin" : "/hesab");
    } catch (err) {
      if (err instanceof ApiError && err.details.length) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      setMsg(err instanceof ApiError && err.message === "Validation failed" ? "Formada səhvlər var." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof f, label: string, type = "text", auto = "") => (
    <label className="field">
      {label}
      <input
        className="input"
        type={type}
        autoComplete={auto}
        value={f[k]}
        onChange={set(k)}
        required={k !== "phone"}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `e-${k}` : undefined}
      />
      {errors[k] && (
        <span id={`e-${k}`} className="err">
          {errors[k]}
        </span>
      )}
    </label>
  );

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="m-0 text-3xl font-bold">{mode === "login" ? "Daxil ol" : "Qeydiyyat"}</h1>
      <div className="mt-4 flex gap-2" role="group" aria-label="Rejim">
        <button type="button" className="chip" aria-pressed={mode === "login"} onClick={() => setMode("login")}>
          Daxil ol
        </button>
        <button type="button" className="chip" aria-pressed={mode === "register"} onClick={() => setMode("register")}>
          Hesab yarat
        </button>
      </div>
      <form className="card mt-4 grid gap-4 p-5" onSubmit={submit}>
        {mode === "register" && field("name", "Ad və soyad", "text", "name")}
        {field("email", "E-poçt", "email", "email")}
        {mode === "register" && field("phone", "Telefon (istəyə bağlı)", "tel", "tel")}
        {field("password", "Şifrə" + (mode === "register" ? " (ən azı 8 simvol)" : ""), "password", mode === "login" ? "current-password" : "new-password")}
        {msg && (
          <p className="err m-0" role="alert">
            {msg}
          </p>
        )}
        <button className="btn btn-brand" disabled={busy}>
          {busy ? "Gözləyin…" : mode === "login" ? "Daxil ol" : "Hesab yarat"}
        </button>
      </form>
      {demo && (
        <p className="mt-4 rounded-lg bg-paper p-3 text-sm">
          Demo rejimdə admin paneli üçün: <span translate="no">{DEMO_ADMIN.email}</span> / <span translate="no">{DEMO_ADMIN.password}</span>. Müştəri hesabı yaratmaq üçün “Hesab yarat” seçin.
        </p>
      )}
    </div>
  );
}
