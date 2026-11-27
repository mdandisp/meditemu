import React from "react";
import SearchWorkspace from "@/components/SearchWorkspace";
import { getMedicalIREngine } from "@/lib/ir-engine";

export default function HomePage() {
  const engine = getMedicalIREngine();
  const categories = engine.getCategories();
  const evalSummary = engine.runSystemEvaluation();

  return (
    <SearchWorkspace
      initialDocuments={engine.documents}
      categories={categories}
      evalSummary={evalSummary}
      defaultQuery="demam batuk"
    />
  );
}
