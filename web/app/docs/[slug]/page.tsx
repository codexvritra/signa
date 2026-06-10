import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE } from "@/lib/miniapp";
import { DOCS } from "../content";

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = DOCS.find((d) => d.slug === slug);
  if (!doc) return {};
  return {
    title: `${doc.nav} — SIGNA docs`,
    description: doc.description,
    openGraph: { title: `${doc.nav} — SIGNA docs`, description: doc.description, url: `${SITE}/docs/${doc.slug}`, type: "article" },
    twitter: { card: "summary_large_image", title: `${doc.nav} — SIGNA docs`, description: doc.description },
  };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = DOCS.find((d) => d.slug === slug);
  if (!doc) notFound();
  return (
    <article>
      <h1 className="font-display text-[26px] sm:text-[32px] leading-[1.12] font-bold tracking-tight mb-2">{doc.title}</h1>
      <p className="text-[14px] text-faint leading-relaxed mb-8">{doc.description}</p>
      {doc.body}
    </article>
  );
}
