// Questions people actually search, with short direct answers.
// Shown on the page as normal text, and repeated as FAQPage data that search engines and AI tools can read.
// (Google stopped showing FAQ rich results in May 2026; the markup is still valid and harmless.)
import JsonLd from "@/components/JsonLd";

export type FaqItem = { q: string; a: string };

export default function Faq({ items, title = "Questions people ask" }: { items: FaqItem[]; title?: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  return (
    <section className="wrap section" id="faq">
      <div className="section-head">
        <h2>{title}</h2>
      </div>
      <div className="card faq">
        {items.map((it) => (
          <div key={it.q} className="faq-item">
            <h3>{it.q}</h3>
            <p>{it.a}</p>
          </div>
        ))}
      </div>
      <JsonLd data={data} />
    </section>
  );
}
