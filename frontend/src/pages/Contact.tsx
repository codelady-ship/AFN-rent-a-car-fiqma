import ContactForm from "../components/ContactForm";
import { ContactList } from "../components/SiteFooter";
import { useMeta } from "../lib/store";

export default function Contact() {
  useMeta("Əlaqə", "AFN rent a car ilə əlaqə: Bakı, Xocalı prospekti 13, +994 50 394 91 94, info@afnrentacar.az. Hər gün 09:00–21:00. Sual, korporativ və avtobus sorğuları.");
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_1.5fr]">
      <div>
        <h1 className="m-0 text-3xl font-bold md:text-4xl">Əlaqə</h1>
        <p className="mt-3 text-muted">Sualınız, korporativ sifarişiniz və ya avtobus sorğunuz var? Yazın və ya zəng edin.</p>
        <ContactList className="mt-4" />
      </div>
      <ContactForm />
    </div>
  );
}
