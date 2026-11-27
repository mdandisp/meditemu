import rawCorpus from "@/data/medical_dataset.json";
import { preprocessText, preprocessWithOptions } from "./preprocessing";
import type {
  BooleanSearchResponse,
  CorpusStats,
  EvalQueryResult,
  ManualCalculationBreakdown,
  ManualTermDetail,
  MedicalDocument,
  PreprocessingAblationScenario,
  SearchResult,
  SystemEvaluationSummary,
  UrgencyLevel
} from "./types";

const RED_FLAG_TERMS = [
  "jantung", "infark", "tidak sadar", "hilang kesadaran", "pingsan",
  "muntah darah", "stroke", "lumpuh separuh", "kejang", "sesak berat",
  "bibir biru", "keracunan", "meningitis", "kaku kuduk", "koma", "nyeri dada sebelah kiri"
];

const URGENCY_WEIGHT: Record<UrgencyLevel, number> = {
  Darurat: 3,
  Sedang: 2,
  Ringan: 1
};

export const BENCHMARK_EVAL_QUERIES = [
  { qid: "Q01", query: "demam tinggi sakit kepala bintik merah", ground_truth: ["MED-001", "MED-004", "MED-007"], intent: "Penyakit tropis dengan ruam dan demam tinggi" },
  { qid: "Q02", query: "batuk kering sesak napas demam hilang penciuman", ground_truth: ["MED-006", "MED-018", "MED-016"], intent: "Infeksi pernapasan akut dengan anosmia" },
  { qid: "Q03", query: "nyeri dada sebelah kiri sesak napas keringat dingin", ground_truth: ["MED-026", "MED-027", "MED-028"], intent: "Sindrom koroner akut / kegawatdaruratan jantung" },
  { qid: "Q04", query: "sakit perut kanan bawah mual muntah demam", ground_truth: ["MED-038", "MED-039"], intent: "Kegawatdaruratan perut kuadran kanan bawah" },
  { qid: "Q05", query: "sering haus sering kencing berat badan turun", ground_truth: ["MED-081", "MED-082"], intent: "Trias gejala klasik hiperglikemia diabetes" },
  { qid: "Q06", query: "gatal bentol kemerahan setelah makan makanan laut", ground_truth: ["MED-071", "MED-072", "MED-078"], intent: "Reaksi alergi makanan akut kulit dan sistemik" },
  { qid: "Q07", query: "nyeri sendi bengkak kemerahan jempol kaki", ground_truth: ["MED-061", "MED-062"], intent: "Radang sendi monoartikular akut podagra" },
  { qid: "Q08", query: "mata kuning kulit kuning perut buncit lemas", ground_truth: ["MED-042", "MED-043", "MED-044"], intent: "Disfungsi hepar / penyakit kuning & asites" },
  { qid: "Q09", query: "pusing berputar sensasi melayang mual muntah", ground_truth: ["MED-051", "MED-052"], intent: "Gangguan sistem vestibular keseimbangan" },
  { qid: "Q10", query: "batuk dahak lama keringat malam berat turun", ground_truth: ["MED-016", "MED-018", "MED-020"], intent: "Penyakit paru kronis curiga tuberkulosis" }
];

export function checkEmergencyRedFlags(query: string): boolean {
  const qLower = query.toLowerCase();
  return RED_FLAG_TERMS.some((term) => qLower.includes(term));
}

function computeRankingMetrics(retrievedIds: string[], groundTruth: Set<string>) {
  const totalRelevant = groundTruth.size;
  const relIn5 = retrievedIds.slice(0, 5).filter((id) => groundTruth.has(id)).length;
  const pAt5 = relIn5 / 5.0;

  const relIn10 = retrievedIds.slice(0, 10).filter((id) => groundTruth.has(id)).length;
  const pAt10 = relIn10 / 10.0;
  const rAt10 = totalRelevant > 0 ? relIn10 / totalRelevant : 0;
  const f1At10 = pAt10 + rAt10 > 0 ? (2 * pAt10 * rAt10) / (pAt10 + rAt10) : 0;

  let runningRel = 0;
  let precSum = 0;
  let firstRelRank = 0;
  retrievedIds.slice(0, 10).forEach((did, idx) => {
    if (groundTruth.has(did)) {
      runningRel += 1;
      precSum += runningRel / (idx + 1);
      if (firstRelRank === 0) firstRelRank = idx + 1;
    }
  });

  const ap = totalRelevant > 0 ? precSum / totalRelevant : 0;
  const rr = firstRelRank > 0 ? 1 / firstRelRank : 0;
  return { pAt5, pAt10, rAt10, f1At10, ap, rr };
}

export class MedicalIREngine {
  public readonly documents: MedicalDocument[];
  public readonly docMap: Map<string, MedicalDocument> = new Map();
  public readonly invertedIndex: Map<string, Set<string>> = new Map();
  public readonly docTokens: Map<string, string[]> = new Map();
  public readonly docTf: Map<string, Record<string, number>> = new Map();
  public readonly docLen: Map<string, number> = new Map();
  public readonly df: Map<string, number> = new Map();
  public readonly idf: Map<string, number> = new Map();
  public readonly docVectors: Map<string, Record<string, number>> = new Map();
  public readonly docNorms: Map<string, number> = new Map();

  public readonly N: number;
  public readonly k1 = 1.5;
  public readonly b = 0.75;
  public readonly avgDocLen: number;
  private readonly preprocessFn: (text: string) => string[];

  constructor(
    docs: MedicalDocument[] = rawCorpus as MedicalDocument[],
    preprocessFn: (text: string) => string[] = (text) => preprocessText(text, false)
  ) {
    this.documents = docs;
    this.N = docs.length;
    this.preprocessFn = preprocessFn;

    let totalLen = 0;

    for (const doc of this.documents) {
      this.docMap.set(doc.doc_id, doc);
      const searchContent = `${doc.disease_name} ${doc.disease_name} ${doc.source_title} ${doc.symptoms} ${doc.symptoms} ${doc.category} ${doc.description}`;
      const tokens = this.preprocessFn(searchContent);

      this.docTokens.set(doc.doc_id, tokens);
      this.docLen.set(doc.doc_id, tokens.length);
      totalLen += tokens.length;

      const tfCounter: Record<string, number> = {};
      for (const t of tokens) {
        tfCounter[t] = (tfCounter[t] ?? 0) + 1;
      }
      this.docTf.set(doc.doc_id, tfCounter);

      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        if (!this.invertedIndex.has(term)) {
          this.invertedIndex.set(term, new Set());
        }
        this.invertedIndex.get(term)!.add(doc.doc_id);
        this.df.set(term, (this.df.get(term) ?? 0) + 1);
      }
    }

    this.avgDocLen = totalLen / Math.max(this.N, 1);

    // IDF = log10(N / DF_t) + 1.0
    for (const [term, docFreq] of this.df.entries()) {
      this.idf.set(term, Math.log10(this.N / docFreq) + 1.0);
    }

    // Document vectors & Euclidean norms
    for (const [docId, tfMap] of this.docTf.entries()) {
      const vec: Record<string, number> = {};
      let sumSq = 0;
      for (const [term, count] of Object.entries(tfMap)) {
        const weight = count * (this.idf.get(term) ?? 0);
        vec[term] = weight;
        sumSq += weight * weight;
      }
      this.docVectors.set(docId, vec);
      this.docNorms.set(docId, Math.sqrt(sumSq));
    }
  }

  public getCategories(): string[] {
    return Array.from(new Set(this.documents.map((d) => d.category))).sort();
  }

  public getCorpusStats(): CorpusStats {
    const lengths = Array.from(this.docLen.values());
    const totalTokens = lengths.reduce((acc, len) => acc + len, 0);
    const minLen = lengths.length > 0 ? Math.min(...lengths) : 0;
    const maxLen = lengths.length > 0 ? Math.max(...lengths) : 0;

    const categoryCounts: Record<string, number> = {};
    const urgencyCounts: Record<UrgencyLevel, number> = {
      Darurat: 0,
      Sedang: 0,
      Ringan: 0
    };

    for (const doc of this.documents) {
      categoryCounts[doc.category] = (categoryCounts[doc.category] ?? 0) + 1;
      urgencyCounts[doc.urgency_level] = (urgencyCounts[doc.urgency_level] ?? 0) + 1;
    }

    return {
      total_documents: this.N,
      vocabulary_size: this.df.size,
      total_tokens: totalTokens,
      avg_doc_length: Math.round(this.avgDocLen * 100) / 100,
      min_doc_length: minLen,
      max_doc_length: maxLen,
      category_counts: categoryCounts,
      urgency_counts: urgencyCounts
    };
  }

  // ==========================================
  // MODEL 1: BOOLEAN RETRIEVAL (SHUNTING-YARD)
  // ==========================================
  public parseBooleanQueryToPostfix(query: string): { postfix: string[]; warning?: string; implicitAndApplied: boolean } {
    const cleaned = query
      .replace(/\bdan\b/gi, " AND ")
      .replace(/\batau\b/gi, " OR ")
      .replace(/\bbukan\b/gi, " NOT ")
      .replace(/\btidak\b/gi, " NOT ");

    const rawTokens = preprocessText(cleaned, true);
    const normalizedTokens: string[] = [];
    let implicitAndApplied = false;

    const isBinaryOp = (t: string) => t === "AND" || t === "OR";
    const isOperator = (t: string) => t === "AND" || t === "OR" || t === "NOT";

    for (const tok of rawTokens) {
      const upper = tok.toUpperCase();
      const canonical = upper === "DAN" ? "AND" : upper === "ATAU" ? "OR" : upper === "BUKAN" || upper === "TIDAK" ? "NOT" : tok;
      const canonUpper = canonical.toUpperCase();

      if (normalizedTokens.length > 0) {
        const prev = normalizedTokens[normalizedTokens.length - 1];
        const prevUpper = prev.toUpperCase();
        const prevIsValueEnd = prev !== "(" && !isOperator(prevUpper);
        const currStartsValue = canonical !== ")" && !isBinaryOp(canonUpper);

        // Sisipkan AND implisit jika dua operand bersebelahan (mis. "demam batuk" atau "(A AND B) NOT C")
        if (prevIsValueEnd && currStartsValue) {
          normalizedTokens.push("AND");
          implicitAndApplied = true;
        }
      }
      normalizedTokens.push(canonical);
    }

    const precedence: Record<string, number> = { NOT: 3, AND: 2, OR: 1 };
    const output: string[] = [];
    const opStack: string[] = [];
    let parenBalance = 0;
    let warning: string | undefined;

    for (const token of normalizedTokens) {
      const upper = token.toUpperCase();
      if (upper in precedence) {
        const isRightAssoc = upper === "NOT";
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1] !== "(" &&
          (isRightAssoc
            ? (precedence[opStack[opStack.length - 1]] ?? 0) > precedence[upper]
            : (precedence[opStack[opStack.length - 1]] ?? 0) >= precedence[upper])
        ) {
          output.push(opStack.pop()!);
        }
        opStack.push(upper);
      } else if (token === "(") {
        parenBalance += 1;
        opStack.push("(");
      } else if (token === ")") {
        parenBalance -= 1;
        if (parenBalance < 0) {
          warning = "Tanda kurung tutup ')' berlebih terdeteksi pada ekspresi Boolean.";
        }
        while (opStack.length > 0 && opStack[opStack.length - 1] !== "(") {
          output.push(opStack.pop()!);
        }
        if (opStack.length > 0 && opStack[opStack.length - 1] === "(") {
          opStack.pop();
        }
      } else {
        // Token sudah di-stem oleh preprocessText(cleaned, true); hindari double stemming
        output.push(token.toLowerCase());
      }
    }

    if (parenBalance > 0) {
      warning = "Tanda kurung buka '(' belum ditutup pada ekspresi Boolean.";
    }

    while (opStack.length > 0) {
      const top = opStack.pop()!;
      if (top !== "(") output.push(top);
    }
    return { postfix: output, warning, implicitAndApplied };
  }

  public searchBoolean(query: string, categoryFilter?: string): BooleanSearchResponse {
    const allDocs = new Set<string>(this.docMap.keys());
    const { postfix, warning, implicitAndApplied } = this.parseBooleanQueryToPostfix(query);

    if (postfix.length === 0) {
      return {
        query,
        postfix_expression: [],
        matches: [],
        count: 0,
        limitation_note: "Kueri kosong atau seluruh kata tereliminasi sebagai stopwords.",
        syntax_warning: warning
      };
    }

    const evalStack: Set<string>[] = [];
    let evalWarning = warning;

    for (const token of postfix) {
      if (token === "NOT") {
        if (evalStack.length < 1) {
          evalWarning = evalWarning ?? "Operator NOT tidak memiliki operand yang valid.";
          continue;
        }
        const operand = evalStack.pop()!;
        const complement = new Set<string>();
        for (const id of allDocs) {
          if (!operand.has(id)) complement.add(id);
        }
        evalStack.push(complement);
      } else if (token === "AND") {
        if (evalStack.length < 2) {
          evalWarning = evalWarning ?? "Operator AND membutuhkan dua operand.";
          continue;
        }
        const right = evalStack.pop()!;
        const left = evalStack.pop()!;
        const inter = new Set<string>();
        for (const id of left) {
          if (right.has(id)) inter.add(id);
        }
        evalStack.push(inter);
      } else if (token === "OR") {
        if (evalStack.length < 2) {
          evalWarning = evalWarning ?? "Operator OR membutuhkan dua operand.";
          continue;
        }
        const right = evalStack.pop()!;
        const left = evalStack.pop()!;
        const uni = new Set<string>(left);
        for (const id of right) uni.add(id);
        evalStack.push(uni);
      } else {
        const posting = this.invertedIndex.get(token) ?? new Set<string>();
        evalStack.push(new Set(posting));
      }
    }

    const resultIds = Array.from(evalStack.pop() ?? []).sort();
    let matches = resultIds
      .map((id) => this.docMap.get(id)!)
      .filter(Boolean);

    if (categoryFilter && categoryFilter !== "Semua Kategori") {
      matches = matches.filter((m) => m.category === categoryFilter);
    }

    const implicitNote = implicitAndApplied
      ? " Operator AND implisit disisipkan antar kata tanpa operator eksplisit."
      : "";

    return {
      query,
      postfix_expression: postfix,
      matches,
      count: matches.length,
      limitation_note:
        "Keterbatasan Boolean Retrieval: Hasil bersifat unranked (tanpa skor relevansi). Dokumen bernilai biner (hanya 1 atau 0), sehingga tidak dapat mengurutkan penyakit berdasarkan tingkat kemiripan." +
        implicitNote,
      syntax_warning: evalWarning
    };
  }

  // ==========================================
  // MODEL 2: VECTOR SPACE MODEL (VSM TF-IDF)
  // ==========================================
  public searchVSM(query: string, topK = 10, categoryFilter?: string): SearchResult[] {
    const qTokens = this.preprocessFn(query);
    if (qTokens.length === 0) return [];

    const qTf: Record<string, number> = {};
    for (const t of qTokens) qTf[t] = (qTf[t] ?? 0) + 1;

    const qVector: Record<string, number> = {};
    let qSumSq = 0;

    for (const [term, count] of Object.entries(qTf)) {
      const termIdf = this.idf.get(term) ?? 0;
      if (termIdf > 0) {
        const weight = count * termIdf;
        qVector[term] = weight;
        qSumSq += weight * weight;
      }
    }

    const qNorm = Math.sqrt(qSumSq);
    if (qNorm === 0) return [];

    interface TempScored extends SearchResult {
      urgencyWeight: number;
    }

    const scored: TempScored[] = [];

    for (const doc of this.documents) {
      if (categoryFilter && categoryFilter !== "Semua Kategori" && doc.category !== categoryFilter) {
        continue;
      }

      const dVector = this.docVectors.get(doc.doc_id) ?? {};
      const dNorm = this.docNorms.get(doc.doc_id) ?? 0;
      if (dNorm === 0) continue;

      let dotProduct = 0;
      const overlapSet = new Set<string>();

      for (const [term, wq] of Object.entries(qVector)) {
        if (dVector[term] !== undefined) {
          dotProduct += wq * dVector[term];
          overlapSet.add(term);
        }
      }

      if (dotProduct > 0) {
        const cosineSim = dotProduct / (qNorm * dNorm);
        const roundedScore = Math.round(cosineSim * 100000) / 100000;
        const overlapTerms = Array.from(overlapSet);

        scored.push({
          rank: 0,
          doc_id: doc.doc_id,
          disease_name: doc.disease_name,
          category: doc.category,
          symptoms: doc.symptoms,
          description: doc.description,
          precaution: doc.precaution,
          urgency_level: doc.urgency_level,
          source: doc.source,
          source_id: doc.source_id,
          source_title: doc.source_title,
          source_url: doc.source_url,
          source_excerpt: doc.source_excerpt,
          source_snapshot: doc.source_snapshot,
          score: roundedScore,
          score_percentage: Math.round(cosineSim * 1000) / 10,
          overlap_terms: overlapTerms,
          overlap_count: overlapTerms.length,
          urgencyWeight: URGENCY_WEIGHT[doc.urgency_level] ?? 1,
          tie_breaker_used: false
        });
      }
    }

    // 3-Tier Deterministic Tie-Breaking:
    // 1. Score DESC -> 2. Overlap Count DESC -> 3. Urgency DESC -> 4. Doc ID ASC
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.overlap_count !== a.overlap_count) return b.overlap_count - a.overlap_count;
      if (b.urgencyWeight !== a.urgencyWeight) return b.urgencyWeight - a.urgencyWeight;
      return a.doc_id.localeCompare(b.doc_id);
    });

    for (let i = 0; i < scored.length - 1; i++) {
      if (scored[i].score === scored[i + 1].score) {
        scored[i].tie_breaker_used = true;
        scored[i + 1].tie_breaker_used = true;
      }
    }

    return scored.slice(0, topK).map((item, idx) => ({
      rank: idx + 1,
      doc_id: item.doc_id,
      disease_name: item.disease_name,
      category: item.category,
      symptoms: item.symptoms,
      description: item.description,
      precaution: item.precaution,
      urgency_level: item.urgency_level,
      source: item.source,
      source_id: item.source_id,
      source_title: item.source_title,
      source_url: item.source_url,
      source_excerpt: item.source_excerpt,
      source_snapshot: item.source_snapshot,
      score: item.score,
      score_percentage: item.score_percentage,
      overlap_terms: item.overlap_terms,
      overlap_count: item.overlap_count,
      tie_breaker_used: item.tie_breaker_used
    }));
  }

  // ==========================================
  // MODEL BONUS: OKAPI BM25
  // ==========================================
  public searchBM25(query: string, topK = 10, categoryFilter?: string): SearchResult[] {
    const qTokens = this.preprocessFn(query);
    if (qTokens.length === 0) return [];

    const uniqueQueryTerms = Array.from(new Set(qTokens));
    const scored: Array<SearchResult & { urgencyWeight: number }> = [];

    for (const doc of this.documents) {
      if (categoryFilter && categoryFilter !== "Semua Kategori" && doc.category !== categoryFilter) {
        continue;
      }

      const dLen = this.docLen.get(doc.doc_id) ?? 0;
      const dTf = this.docTf.get(doc.doc_id) ?? {};
      let bm25Score = 0;
      const overlapSet = new Set<string>();

      for (const term of uniqueQueryTerms) {
        const freq = dTf[term] ?? 0;
        if (freq > 0) {
          const idfVal = this.idf.get(term) ?? 0;
          const num = freq * (this.k1 + 1);
          const den = freq + this.k1 * (1 - this.b + this.b * (dLen / this.avgDocLen));
          bm25Score += idfVal * (num / den);
          overlapSet.add(term);
        }
      }

      if (bm25Score > 0) {
        const roundedScore = Math.round(bm25Score * 10000) / 10000;
        const overlapTerms = Array.from(overlapSet);
        scored.push({
          rank: 0,
          doc_id: doc.doc_id,
          disease_name: doc.disease_name,
          category: doc.category,
          symptoms: doc.symptoms,
          description: doc.description,
          precaution: doc.precaution,
          urgency_level: doc.urgency_level,
          source: doc.source,
          source_id: doc.source_id,
          source_title: doc.source_title,
          source_url: doc.source_url,
          source_excerpt: doc.source_excerpt,
          source_snapshot: doc.source_snapshot,
          score: roundedScore,
          score_percentage: Math.min(99.9, Math.round((bm25Score / 15) * 1000) / 10),
          overlap_terms: overlapTerms,
          overlap_count: overlapTerms.length,
          urgencyWeight: URGENCY_WEIGHT[doc.urgency_level] ?? 1,
          tie_breaker_used: false
        });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.overlap_count !== a.overlap_count) return b.overlap_count - a.overlap_count;
      if (b.urgencyWeight !== a.urgencyWeight) return b.urgencyWeight - a.urgencyWeight;
      return a.doc_id.localeCompare(b.doc_id);
    });

    for (let i = 0; i < scored.length - 1; i++) {
      if (scored[i].score === scored[i + 1].score) {
        scored[i].tie_breaker_used = true;
        scored[i + 1].tie_breaker_used = true;
      }
    }

    return scored.slice(0, topK).map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));
  }

  // ==========================================
  // X-RAY PERHITUNGAN MANUAL
  // ==========================================
  public getManualCalculationSteps(query: string, docId: string): ManualCalculationBreakdown | null {
    const doc = this.docMap.get(docId);
    if (!doc) return null;

    const qTokens = this.preprocessFn(query);
    const qTf: Record<string, number> = {};
    for (const t of qTokens) qTf[t] = (qTf[t] ?? 0) + 1;

    const dTf = this.docTf.get(docId) ?? {};
    const termsDetail: ManualTermDetail[] = [];
    let dotProduct = 0;
    let qSumSq = 0;

    for (const [term, tfQ] of Object.entries(qTf)) {
      const tfD = dTf[term] ?? 0;
      const dfVal = this.df.get(term) ?? 0;
      const idfVal = this.idf.get(term) ?? 0;
      const wQ = tfQ * idfVal;
      const wD = tfD * idfVal;
      const prod = wQ * wD;

      dotProduct += prod;
      qSumSq += wQ * wQ;

      termsDetail.push({
        term,
        tf_query: tfQ,
        tf_doc: tfD,
        df: dfVal,
        idf: Math.round(idfVal * 10000) / 10000,
        w_query: Math.round(wQ * 10000) / 10000,
        w_doc: Math.round(wD * 10000) / 10000,
        product_wq_wd: Math.round(prod * 10000) / 10000
      });
    }

    const qNorm = Math.sqrt(qSumSq);
    const dNorm = this.docNorms.get(docId) ?? 0;
    const denominator = qNorm * dNorm;
    const cosineSim = denominator > 0 ? dotProduct / denominator : 0;

    return {
      query_original: query,
      query_preprocessed: qTokens,
      doc_id: docId,
      disease_name: doc.disease_name,
      total_documents_N: this.N,
      doc_token_count: this.docLen.get(docId) ?? 0,
      indexing_note:
        "Dokumen diindeks dengan field weighting (2x disease_name, 2x symptoms, 1x source_title, 1x category, 1x description). Norma ||D|| dihitung atas seluruh term unik dalam dokumen terindeks tersebut.",
      terms_detail: termsDetail,
      dot_product_sum: Math.round(dotProduct * 10000) / 10000,
      query_norm: Math.round(qNorm * 10000) / 10000,
      doc_norm: Math.round(dNorm * 10000) / 10000,
      denominator: Math.round(denominator * 10000) / 10000,
      final_cosine_similarity: Math.round(cosineSim * 100000) / 100000,
      final_percentage: Math.round(cosineSim * 10000) / 100
    };
  }

  // ==========================================
  // EKSPERIMEN PENGARUH PREPROCESSING (ABLATION)
  // ==========================================
  public runPreprocessingImpactExperiment(): PreprocessingAblationScenario[] {
    const scenarios: Array<{
      id: string;
      label: string;
      description: string;
      fn: (t: string) => string[];
    }> = [
      {
        id: "raw_baseline",
        label: "1. Baseline (Case Folding + Tokenisasi)",
        description: "Tanpa stopword removal, tanpa normalisasi slang medis, dan tanpa stemming.",
        fn: (t: string) =>
          preprocessWithOptions(t, {
            useNormalization: false,
            useStopwordRemoval: false,
            useStemming: false
          })
      },
      {
        id: "stopword_only",
        label: "2. + Stopword Removal (Tanpa Slang & Stemming)",
        description: "Case folding, tokenisasi, dan penghapusan stopwords umum tanpa normalisasi/stemming.",
        fn: (t: string) =>
          preprocessWithOptions(t, {
            useNormalization: false,
            useStopwordRemoval: true,
            useStemming: false
          })
      },
      {
        id: "full_pipeline",
        label: "3. Full Pipeline (Slang + Stopword + Stemming)",
        description: "Seluruh 5 tahap preprocessing aktif (Case Folding, Normalisasi, Tokenisasi, Stopword Removal, Stemming).",
        fn: (t: string) => preprocessText(t, false)
      }
    ];

    return scenarios.map((sc) => {
      const subEngine =
        sc.id === "full_pipeline" ? this : new MedicalIREngine(this.documents, sc.fn);
      const nQ = BENCHMARK_EVAL_QUERIES.length;
      let sumP5 = 0;
      let sumP10 = 0;
      let sumR10 = 0;
      let sumAp = 0;
      let sumRr = 0;

      for (const item of BENCHMARK_EVAL_QUERIES) {
        const gt = new Set(item.ground_truth);
        const retrievedIds = subEngine.searchVSM(item.query, 10).map((d) => d.doc_id);
        const m = computeRankingMetrics(retrievedIds, gt);
        sumP5 += m.pAt5;
        sumP10 += m.pAt10;
        sumR10 += m.rAt10;
        sumAp += m.ap;
        sumRr += m.rr;
      }

      return {
        scenario_id: sc.id,
        label: sc.label,
        description: sc.description,
        vocabulary_size: subEngine.df.size,
        avg_doc_length: Math.round(subEngine.avgDocLen * 100) / 100,
        mean_p5: Math.round((sumP5 / nQ) * 1000) / 1000,
        mean_p10: Math.round((sumP10 / nQ) * 1000) / 1000,
        mean_r10: Math.round((sumR10 / nQ) * 1000) / 1000,
        map: Math.round((sumAp / nQ) * 1000) / 1000,
        mrr: Math.round((sumRr / nQ) * 1000) / 1000
      };
    });
  }

  // ==========================================
  // EVALUASI 10 QUERY BENCHMARK (VSM vs BM25 vs BOOLEAN)
  // ==========================================
  public runSystemEvaluation(): SystemEvaluationSummary {
    const queryResults: EvalQueryResult[] = [];
    let sumP5 = 0;
    let sumP10 = 0;
    let sumR10 = 0;
    let sumF1_10 = 0;
    let sumAp = 0;
    let sumRr = 0;

    let sumBmP5 = 0;
    let sumBmP10 = 0;
    let sumBmR10 = 0;
    let sumBmF1_10 = 0;
    let sumBmAp = 0;
    let sumBmRr = 0;

    let sumBoolP10 = 0;
    let sumBoolR10 = 0;
    let sumBoolF1_10 = 0;
    let sumBoolAndP10 = 0;
    let sumBoolAndR10 = 0;
    let boolAndZeroRecallCount = 0;

    for (const item of BENCHMARK_EVAL_QUERIES) {
      const gt = new Set(item.ground_truth);
      const totalRelevant = gt.size;

      // VSM
      const retrieved = this.searchVSM(item.query, 10);
      const retrievedIds = retrieved.map((d) => d.doc_id);
      const vsmM = computeRankingMetrics(retrievedIds, gt);

      // BM25
      const bmRetrieved = this.searchBM25(item.query, 10);
      const bmIds = bmRetrieved.map((d) => d.doc_id);
      const bmM = computeRankingMetrics(bmIds, gt);

      // Boolean OR (Unranked)
      const boolRes = this.searchBoolean(item.query.trim().split(/\s+/).join(" OR "));
      const boolIds = boolRes.matches.slice(0, 10).map((d) => d.doc_id);
      const boolRel = boolIds.filter((id) => gt.has(id)).length;
      const boolP10 = boolRel / Math.max(boolIds.length, 1);
      const boolR10 = totalRelevant > 0 ? boolRel / totalRelevant : 0;
      const boolF1_10 = boolP10 + boolR10 > 0 ? (2 * boolP10 * boolR10) / (boolP10 + boolR10) : 0;

      // Boolean AND (Strict)
      const boolAndRes = this.searchBoolean(item.query.trim().split(/\s+/).join(" AND "));
      const boolAndIds = boolAndRes.matches.slice(0, 10).map((d) => d.doc_id);
      const boolAndRel = boolAndIds.filter((id) => gt.has(id)).length;
      const boolAndP10 = boolAndIds.length > 0 ? boolAndRel / boolAndIds.length : 0;
      const boolAndR10 = totalRelevant > 0 ? boolAndRel / totalRelevant : 0;
      if (boolAndRes.count === 0) boolAndZeroRecallCount += 1;

      sumP5 += vsmM.pAt5;
      sumP10 += vsmM.pAt10;
      sumR10 += vsmM.rAt10;
      sumF1_10 += vsmM.f1At10;
      sumAp += vsmM.ap;
      sumRr += vsmM.rr;

      sumBmP5 += bmM.pAt5;
      sumBmP10 += bmM.pAt10;
      sumBmR10 += bmM.rAt10;
      sumBmF1_10 += bmM.f1At10;
      sumBmAp += bmM.ap;
      sumBmRr += bmM.rr;

      sumBoolP10 += boolP10;
      sumBoolR10 += boolR10;
      sumBoolF1_10 += boolF1_10;
      sumBoolAndP10 += boolAndP10;
      sumBoolAndR10 += boolAndR10;

      const relevantFound = retrieved
        .filter((d) => gt.has(d.doc_id))
        .map((d) => `#${d.rank} ${d.doc_id} (${d.disease_name})`);
      const nonRelevantFound = retrieved
        .slice(0, 5)
        .filter((d) => !gt.has(d.doc_id))
        .map((d) => `#${d.rank} ${d.doc_id} (${d.disease_name})`);

      queryResults.push({
        qid: item.qid,
        query: item.query,
        intent: item.intent,
        ground_truth_ids: item.ground_truth,
        ground_truth_count: totalRelevant,
        vsm_p5: Math.round(vsmM.pAt5 * 1000) / 1000,
        vsm_p10: Math.round(vsmM.pAt10 * 1000) / 1000,
        vsm_r10: Math.round(vsmM.rAt10 * 1000) / 1000,
        vsm_f1_10: Math.round(vsmM.f1At10 * 1000) / 1000,
        vsm_ap: Math.round(vsmM.ap * 1000) / 1000,
        vsm_rr: Math.round(vsmM.rr * 1000) / 1000,
        bm25_p5: Math.round(bmM.pAt5 * 1000) / 1000,
        bm25_p10: Math.round(bmM.pAt10 * 1000) / 1000,
        bm25_r10: Math.round(bmM.rAt10 * 1000) / 1000,
        bm25_f1_10: Math.round(bmM.f1At10 * 1000) / 1000,
        bm25_ap: Math.round(bmM.ap * 1000) / 1000,
        bm25_rr: Math.round(bmM.rr * 1000) / 1000,
        boolean_p10: Math.round(boolP10 * 1000) / 1000,
        boolean_r10: Math.round(boolR10 * 1000) / 1000,
        boolean_f1_10: Math.round(boolF1_10 * 1000) / 1000,
        boolean_match_count: boolRes.count,
        boolean_and_p10: Math.round(boolAndP10 * 1000) / 1000,
        boolean_and_r10: Math.round(boolAndR10 * 1000) / 1000,
        boolean_and_match_count: boolAndRes.count,
        relevant_found: relevantFound,
        non_relevant_found: nonRelevantFound,
        top_retrieved: retrieved.slice(0, 3).map((d) => `${d.doc_id} (${d.disease_name})`)
      });
    }

    const nQ = BENCHMARK_EVAL_QUERIES.length;
    const preprocessingAblation = this.runPreprocessingImpactExperiment();

    return {
      query_results: queryResults,
      mean_precision_at_5: Math.round((sumP5 / nQ) * 1000) / 1000,
      mean_precision_at_10: Math.round((sumP10 / nQ) * 1000) / 1000,
      mean_recall_at_10: Math.round((sumR10 / nQ) * 1000) / 1000,
      mean_f1_at_10: Math.round((sumF1_10 / nQ) * 1000) / 1000,
      mean_average_precision_MAP: Math.round((sumAp / nQ) * 1000) / 1000,
      mean_reciprocal_rank_MRR: Math.round((sumRr / nQ) * 1000) / 1000,
      bm25_mean_precision_at_5: Math.round((sumBmP5 / nQ) * 1000) / 1000,
      bm25_mean_precision_at_10: Math.round((sumBmP10 / nQ) * 1000) / 1000,
      bm25_mean_recall_at_10: Math.round((sumBmR10 / nQ) * 1000) / 1000,
      bm25_mean_f1_at_10: Math.round((sumBmF1_10 / nQ) * 1000) / 1000,
      bm25_MAP: Math.round((sumBmAp / nQ) * 1000) / 1000,
      bm25_MRR: Math.round((sumBmRr / nQ) * 1000) / 1000,
      boolean_mean_precision_at_10: Math.round((sumBoolP10 / nQ) * 1000) / 1000,
      boolean_mean_recall_at_10: Math.round((sumBoolR10 / nQ) * 1000) / 1000,
      boolean_mean_f1_at_10: Math.round((sumBoolF1_10 / nQ) * 1000) / 1000,
      boolean_and_mean_precision_at_10: Math.round((sumBoolAndP10 / nQ) * 1000) / 1000,
      boolean_and_mean_recall_at_10: Math.round((sumBoolAndR10 / nQ) * 1000) / 1000,
      boolean_and_zero_recall_queries: boolAndZeroRecallCount,
      preprocessing_ablation: preprocessingAblation,
      total_queries_tested: nQ
    };
  }
}

// Singleton instance
let engineInstance: MedicalIREngine | null = null;
export function getMedicalIREngine(): MedicalIREngine {
  if (!engineInstance) {
    engineInstance = new MedicalIREngine();
  }
  return engineInstance;
}
