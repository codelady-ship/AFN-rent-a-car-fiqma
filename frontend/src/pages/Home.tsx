import { useMemo } from "react";
import AfnStory from "../landing/AfnStory";
import { FAQ } from "../landing/faq";
import { usePageMeta } from "../lib/store";
import { PAGE_META } from "../lib/routeMeta";

export default function Home() {
  usePageMeta(PAGE_META.home);
  // FAQPage structured data: the same questions and answers that are visible on the page
  const faqLd = useMemo(
    () =>
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      }),
    []
  );
  return (
    <main id="main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
      <AfnStory />
    </main>
  );
}
