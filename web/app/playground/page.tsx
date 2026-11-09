import JsonLd from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import type { Metadata } from "next";
import Playground from "@/components/Playground";

export const metadata: Metadata = { title: "Playground", description: "Try Evalgate's checks on your own answers, in the browser.", alternates: { canonical: "/playground" } };

export default function PlaygroundPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <div className="eyebrow">Playground</div>
        <h1>Try a check on your own answer</h1>
        <p>
          Pick a check, paste an answer from your app and what you expected, and see what Evalgate would decide. Nothing leaves
          your browser.
        </p>
      </div>
      <Playground />
      <JsonLd data={breadcrumbLd("Playground", "/playground")} />
    </div>
  );
}
