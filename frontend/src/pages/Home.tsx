import { useMemo } from "react";
import AfnStory from "../landing/AfnStory";
import { FAQ } from "../landing/faq";
import { useMeta } from "../lib/store";

export default function Home() {
  useMeta("AFN rent a car – Bakıda avtomobil icarəsi", "AFN rent a car: Bakıda ekonom, biznes, premium, SUV və avtobus icarəsi. Onlayn rezervasiya, şəffaf qiymət, hava limanına və ünvana çatdırılma.");
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
