import type { Metadata } from "next";
import CorpusExplorer from "@/components/CorpusExplorer";
import { getMedicalIREngine } from "@/lib/ir-engine";

export const metadata: Metadata = {
  title: "Struktur Database & Korpus 135 Dokumen | MediTemu",
  description:
    "Skema database terkurasi dan penjelajah 135 dokumen penyakit medis resmi dari MedlinePlus Health Topics XML (NIH / NLM) lengkap dengan tautan sumber."
};

export default async function KorpusPage({
  searchParams
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const engine = getMedicalIREngine();
  const resolved = await searchParams;

  return (
    <CorpusExplorer
      documents={engine.documents}
      categories={engine.getCategories()}
      initialDocId={resolved?.doc}
    />
  );
}
