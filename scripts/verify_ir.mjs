import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Load TypeScript modules directly in Node 22 (--experimental-strip-types)
// Resolve relative imports cleanly without Next.js bundler
const root = process.cwd();
const docs = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/medical_dataset.json"), "utf8")
);

const prepUrl = new URL("../src/lib/preprocessing.ts", import.meta.url);

// Create a small wrapper for ir-engine.ts because it imports `@/data/medical_dataset.json` and extensionless TS modules
const tmpDir = fs.mkdtempSync(path.join(root, ".verify-tmp-"));
try {
  fs.copyFileSync(path.join(root, "src/lib/types.ts"), path.join(tmpDir, "types.mts"));
  const prepSource = fs
    .readFileSync(path.join(root, "src/lib/preprocessing.ts"), "utf8")
    .replace('from "./types";', 'from "./types.mts";');
  fs.writeFileSync(path.join(tmpDir, "preprocessing.mts"), prepSource);

  const prep = await import(new URL(`file:///${path.join(tmpDir, "preprocessing.mts").replace(/\\/g, "/")}`).href);

  const irSource = fs
    .readFileSync(path.join(root, "src/lib/ir-engine.ts"), "utf8")
    .replace(
      'import rawCorpus from "@/data/medical_dataset.json";',
      `import { readFileSync } from "node:fs"; const rawCorpus = JSON.parse(readFileSync(${JSON.stringify(
        path.join(root, "src/data/medical_dataset.json")
      )}, "utf8"));`
    )
    .replace('from "./preprocessing";', 'from "./preprocessing.mts";')
    .replace('from "./types";', 'from "./types.mts";');
  fs.writeFileSync(path.join(tmpDir, "ir-engine.mts"), irSource);

  const { MedicalIREngine } = await import(new URL(`file:///${path.join(tmpDir, "ir-engine.mts").replace(/\\/g, "/")}`).href);

  // 1. Dataset check (>= 100 documents)
  assert.ok(docs.length >= 100, `Dataset harus >= 100 dokumen, ditemukan ${docs.length}`);
  for (const d of docs) {
    assert.ok(d.doc_id && d.disease_name && d.symptoms && d.source_url, `Metadata tidak lengkap pada ${d.doc_id}`);
  }

  // 2. Preprocessing 5-stage check
  const steps = prep.inspectPreprocessingSteps("Pasien merasakan meriang, puyeng, dan batuk-batuk berdarah!");
  assert.equal(steps.case_folding, "pasien merasakan meriang, puyeng, dan batuk-batuk berdarah!");
  assert.ok(steps.normalized.includes("demam") && steps.normalized.includes("pusing"));
  assert.ok(steps.tokenized.length > 0);
  assert.ok(!steps.stopword_removed.includes("dan") && !steps.stopword_removed.includes("pasien"));
  assert.ok(steps.stemmed.includes("darah"));

  const engine = new MedicalIREngine(docs);
  const stats = engine.getCorpusStats();
  assert.equal(stats.total_documents, 135);
  assert.ok(stats.vocabulary_size > 500);

  // 3. Boolean Retrieval check (AND, OR, NOT, implicit AND, Indonesian keywords)
  const bAnd = engine.searchBoolean("demam AND batuk");
  const bImplicit = engine.searchBoolean("demam batuk");
  assert.equal(bAnd.count, bImplicit.count, "Implicit AND harus menghasilkan jumlah dokumen yang sama dengan explicit AND");
  assert.ok(bAnd.count > 0);

  const bNot = engine.searchBoolean("tidak demam");
  const bDemam = engine.searchBoolean("demam");
  assert.equal(bNot.count + bDemam.count, engine.N, "Komplemen NOT demam + demam harus sama dengan N");

  const bComplex = engine.searchBoolean("(demam AND batuk) NOT pilek");
  assert.ok(bComplex.count > 0 && bComplex.count < bAnd.count);

  // 4. VSM & X-Ray manual math consistency check
  const vsmTop5 = engine.searchVSM("demam batuk", 5);
  assert.equal(vsmTop5.length, 5);
  for (let i = 1; i < vsmTop5.length; i++) {
    assert.ok(vsmTop5[i - 1].score >= vsmTop5[i].score, "Hasil VSM harus terurut descending");
  }
  const xray = engine.getManualCalculationSteps("demam batuk", vsmTop5[0].doc_id);
  assert.ok(xray !== null);
  assert.equal(xray.final_cosine_similarity, vsmTop5[0].score, "Skor X-Ray manual harus identik dengan skor VSM");

  // 5. BM25 check
  const bm25Top5 = engine.searchBM25("demam batuk", 5);
  assert.equal(bm25Top5.length, 5);

  // 6. Evaluation 10 queries + Ablation check
  const evalSummary = engine.runSystemEvaluation();
  assert.equal(evalSummary.total_queries_tested, 10);
  assert.ok(evalSummary.mean_average_precision_MAP > 0);
  assert.ok(evalSummary.bm25_MAP > 0);
  assert.equal(evalSummary.preprocessing_ablation.length, 3);

  console.log("VERIFICATION PASSED");
  console.log({
    documents: stats.total_documents,
    vocabulary: stats.vocabulary_size,
    avgDocLen: stats.avg_doc_length,
    vsm: {
      P5: evalSummary.mean_precision_at_5,
      P10: evalSummary.mean_precision_at_10,
      R10: evalSummary.mean_recall_at_10,
      MAP: evalSummary.mean_average_precision_MAP,
      MRR: evalSummary.mean_reciprocal_rank_MRR
    },
    bm25: {
      P5: evalSummary.bm25_mean_precision_at_5,
      P10: evalSummary.bm25_mean_precision_at_10,
      R10: evalSummary.bm25_mean_recall_at_10,
      MAP: evalSummary.bm25_MAP,
      MRR: evalSummary.bm25_MRR
    },
    boolean: {
      OR_P10: evalSummary.boolean_mean_precision_at_10,
      AND_P10: evalSummary.boolean_and_mean_precision_at_10,
      AND_zero_recall_queries: evalSummary.boolean_and_zero_recall_queries
    },
    ablation: evalSummary.preprocessing_ablation.map((s) => ({
      id: s.scenario_id,
      vocab: s.vocabulary_size,
      MAP: s.map,
      MRR: s.mrr
    }))
  });
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
