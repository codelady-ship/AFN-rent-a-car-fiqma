import ContactForm from "../components/ContactForm";
import { ContactList } from "../components/SiteFooter";
import { usePageMeta } from "../lib/store";
import { PAGE_META } from "../lib/routeMeta";

export default function Contact() {
  usePageMeta(PAGE_META.elaqe);
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
