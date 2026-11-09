// Puts structured data (schema.org JSON-LD) into the page for search engines and AI assistants.
// "<" is escaped so text inside the data can never close the script tag (Next.js's recommended pattern).
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
