import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { ApiError } from "../lib/types";

export default function ContactForm({ idPrefix = "c" }: { idPrefix?: string }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", subject: "", message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er.name = "Adınızı yazın.";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = "E-poçtu düzgün yazın.";
    if (f.message.trim().length < 10) er.message = "Mesaj ən azı 10 simvol olmalıdır.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setState("sending");
    setMsg("");
    try {
      const { website, phone, ...rest } = f;
      await api.contact({ ...rest, ...(phone ? { phone } : {}), ...(website ? { website } : {}) } as never);
      setState("sent");
    } catch (err) {
      if (err instanceof ApiError && err.details.length) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      setMsg((err as Error).message);
      setState("idle");
    }
  };

  if (state === "sent")
    return (
      <p className="card m-0 p-5" role="status">
        <strong>Mesajınız göndərildi.</strong> İş saatlarında sizə cavab verəcəyik.
      </p>
    );

  const id = (k: string) => `${idPrefix}-${k}`;
  const props = (k: string) => ({ id: id(k), "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? id(k) + "-e" : undefined });
  const err = (k: string) =>
    errors[k] ? (
      <span id={id(k) + "-e"} className="err">
        {errors[k]}
      </span>
    ) : null;

  return (
    <form className="card grid gap-4 p-5 text-ink sm:grid-cols-2" onSubmit={submit} noValidate aria-label="Əlaqə forması">
      <label className="field" htmlFor={id("name")}>
        Ad
        <input className="input" autoComplete="name" value={f.name} onChange={set("name")} {...props("name")} />
        {err("name")}
      </label>
      <label className="field" htmlFor={id("email")}>
        E-poçt
        <input className="input" type="email" autoComplete="email" value={f.email} onChange={set("email")} {...props("email")} />
        {err("email")}
      </label>
      <label className="field" htmlFor={id("phone")}>
        Telefon (istəyə bağlı)
        <input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} {...props("phone")} />
        {err("phone")}
      </label>
      <label className="field" htmlFor={id("subject")}>
        Mövzu
        <input className="input" value={f.subject} onChange={set("subject")} {...props("subject")} />
      </label>
      <label className="field sm:col-span-2" htmlFor={id("message")}>
        Mesaj
        <textarea className="input" rows={4} maxLength={2000} value={f.message} onChange={set("message")} {...props("message")} />
        {err("message")}
      </label>
      {/* honeypot for bots; hidden from people and screen readers */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} className="hidden" aria-hidden="true" />
      {msg && (
        <p className="err m-0 sm:col-span-2" role="alert">
          {msg === "Validation failed" ? "Formada səhvlər var." : msg}
        </p>
      )}
      <button className="btn btn-brand justify-self-start" disabled={state === "sending"}>
        {state === "sending" ? "Göndərilir…" : "Göndər"}
      </button>
    </form>
  );
}
