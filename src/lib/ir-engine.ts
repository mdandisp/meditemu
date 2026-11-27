import rawCorpus from "@/data/medical_dataset.json";
import { preprocessText, stemToken } from "./preprocessing";
import type {
  BooleanSearchResponse,
  EvalQueryResult,
  ManualCalculationBreakdown,
  ManualTermDetail,
  MedicalDocument,
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

export function checkEmergencyRedFlags(query: string): boolean {
  const qLower = query.toLowerCase();
  return RED_FLAG_TERMS.some((term) => qLower.includes(term));
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

  constructor(docs: MedicalDocument[] = rawCorpus as MedicalDocument[]) {
    this.documents = docs;
    this.N = docs.length;

    let totalLen = 0;

    for (const doc of this.documents) {
      this.docMap.set(doc.doc_id, doc);
      const searchContent = `${doc.disease_name} ${doc.disease_name} ${doc.source_title} ${doc.symptoms} ${doc.symptoms} ${doc.category} ${doc.description}`;
      const tokens = preprocessText(searchContent);

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

  // ==========================================
  // MODEL 1: BOOLEAN RETRIEVAL (SHUNTING-YARD)
  // ==========================================
  public parseBooleanQueryToPostfix(query: string): string[] {
    let cleaned = query
      .replace(/ dan /gi, " AND ")
      .replace(/ atau /gi, " OR ")
      .replace(/ bukan /gi, " NOT ")
      .replace(/ tidak /gi, " NOT ");

    const rawTokens = preprocessText(cleaned, true);
    // Sisipkan operator AND implisit sebelum NOT jika didahului operand atau ")", mis. "(A AND B) NOT C"
    const normalizedTokens: string[] = [];
    for (let i = 0; i < rawTokens.length; i++) {
      const tok = rawTokens[i];
      const upper = tok.toUpperCase();
      if (upper === "NOT" && normalizedTokens.length > 0) {
        const prevUpper = normalizedTokens[normalizedTokens.length - 1].toUpperCase();
        if (prevUpper !== "(" && prevUpper !== "AND" && prevUpper !== "OR" && prevUpper !== "NOT") {
          normalizedTokens.push("AND");
        }
      }
      normalizedTokens.push(tok);
    }

    const precedence: Record<string, number> = { NOT: 3, AND: 2, OR: 1 };
    const output: string[] = [];
    const opStack: string[] = [];

    for (const token of normalizedTokens) {
      const upper = token.toUpperCase();
      if (upper in precedence) {
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1] !== "(" &&
          (precedence[opStack[opStack.length - 1]] ?? 0) >= precedence[upper]
        ) {
          output.push(opStack.pop()!);
        }
        opStack.push(upper);
      } else if (token === "(") {
        opStack.push("(");
      } else if (token === ")") {
        while (opStack.length > 0 && opStack[opStack.length - 1] !== "(") {
          output.push(opStack.pop()!);
        }
        if (opStack.length > 0 && opStack[opStack.length - 1] === "(") {
          opStack.pop();
        }
      } else {
        output.push(stemToken(token.toLowerCase()));
      }
    }

    while (opStack.length > 0) {
      output.push(opStack.pop()!);
    }
    return output;
  }

  public searchBoolean(query: string, categoryFilter?: string): BooleanSearchResponse {
    const allDocs = new Set<string>(this.docMap.keys());
    const postfix = this.parseBooleanQueryToPostfix(query);

    if (postfix.length === 0) {
      return {
        query,
        postfix_expression: [],
        matches: [],
        count: 0,
        limitation_note: "Kueri kosong atau seluruh kata tereliminasi sebagai stopwords."
      };
    }

    const evalStack: Set<string>[] = [];

    for (const token of postfix) {
      if (token === "NOT") {
        const operand = evalStack.pop() ?? new Set<string>();
        const complement = new Set<string>();
        for (const id of allDocs) {
          if (!operand.has(id)) complement.add(id);
        }
        evalStack.push(complement);
      } else if (token === "AND") {
        const right = evalStack.pop() ?? new Set<string>();
        const left = evalStack.pop() ?? new Set<string>();
        const inter = new Set<string>();
        for (const id of left) {
          if (right.has(id)) inter.add(id);
        }
        evalStack.push(inter);
      } else if (token === "OR") {
        const right = evalStack.pop() ?? new Set<string>();
        const left = evalStack.pop() ?? new Set<string>();
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

    return {
      query,
      postfix_expression: postfix,
      matches,
      count: matches.length,
      limitation_note:
        "Keterbatasan Boolean Retrieval: Hasil bersifat unranked (tanpa skor relevansi). Dokumen bernilai biner (hanya 1 atau 0), sehingga tidak dapat mengurutkan penyakit berdasarkan tingkat kemiripan."
    };
  }

  // ==========================================
  // MODEL 2: VECTOR SPACE MODEL (VSM TF-IDF)
  // ==========================================
  public searchVSM(query: string, topK = 10, categoryFilter?: string): SearchResult[] {
    const qTokens = preprocessText(query);
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
    const qTokens = preprocessText(query);
    if (qTokens.length === 0) return [];

    const scored: Array<SearchResult & { urgencyWeight: number }> = [];

    for (const doc of this.documents) {
      if (categoryFilter && categoryFilter !== "Semua Kategori" && doc.category !== categoryFilter) {
        continue;
      }

      const dLen = this.docLen.get(doc.doc_id) ?? 0;
      const dTf = this.docTf.get(doc.doc_id) ?? {};
      let bm25Score = 0;
      const overlapSet = new Set<string>();

      for (const term of qTokens) {
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
      return a.doc_id.localeCompare(b.doc_id);
    });

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

    const qTokens = preprocessText(query);
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
  // EVALUASI 10 QUERY BENCHMARK (MAP)
  // ==========================================
  public runSystemEvaluation(): SystemEvaluationSummary {
    const evalQueries = [
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

    const queryResults: EvalQueryResult[] = [];
    let sumP5 = 0;
    let sumP10 = 0;
    let sumR10 = 0;
    let sumF1_10 = 0;
    let sumAp = 0;
    let sumRr = 0;
    let sumBoolP10 = 0;
    let sumBoolR10 = 0;
    let sumBoolF1_10 = 0;

    for (const item of evalQueries) {
      const gt = new Set(item.ground_truth);
      const totalRelevant = gt.size;

      const retrieved = this.searchVSM(item.query, 10);
      const retrievedIds = retrieved.map((d) => d.doc_id);

      const relIn5 = retrievedIds.slice(0, 5).filter((id) => gt.has(id)).length;
      const pAt5 = relIn5 / 5.0;

      const relIn10 = retrievedIds.filter((id) => gt.has(id)).length;
      const pAt10 = relIn10 / 10.0;
      const rAt10 = totalRelevant > 0 ? relIn10 / totalRelevant : 0;
      const f1At10 = pAt10 + rAt10 > 0 ? (2 * pAt10 * rAt10) / (pAt10 + rAt10) : 0;

      let runningRel = 0;
      let precSum = 0;
      let firstRelRank = 0;
      retrievedIds.forEach((did, idx) => {
        if (gt.has(did)) {
          runningRel += 1;
          precSum += runningRel / (idx + 1);
          if (firstRelRank === 0) firstRelRank = idx + 1;
        }
      });
      const ap = totalRelevant > 0 ? precSum / totalRelevant : 0;
      const rr = firstRelRank > 0 ? 1 / firstRelRank : 0;

      const boolRes = this.searchBoolean(item.query.replace(/ /g, " OR "));
      const boolIds = boolRes.matches.slice(0, 10).map((d) => d.doc_id);
      const boolRel = boolIds.filter((id) => gt.has(id)).length;
      const boolP10 = boolRel / Math.max(boolIds.length, 1);
      const boolR10 = totalRelevant > 0 ? boolRel / totalRelevant : 0;
      const boolF1_10 = boolP10 + boolR10 > 0 ? (2 * boolP10 * boolR10) / (boolP10 + boolR10) : 0;

      sumP5 += pAt5;
      sumP10 += pAt10;
      sumR10 += rAt10;
      sumF1_10 += f1At10;
      sumAp += ap;
      sumRr += rr;
      sumBoolP10 += boolP10;
      sumBoolR10 += boolR10;
      sumBoolF1_10 += boolF1_10;

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
        vsm_p5: Math.round(pAt5 * 1000) / 1000,
        vsm_p10: Math.round(pAt10 * 1000) / 1000,
        vsm_r10: Math.round(rAt10 * 1000) / 1000,
        vsm_f1_10: Math.round(f1At10 * 1000) / 1000,
        vsm_ap: Math.round(ap * 1000) / 1000,
        vsm_rr: Math.round(rr * 1000) / 1000,
        boolean_p10: Math.round(boolP10 * 1000) / 1000,
        boolean_r10: Math.round(boolR10 * 1000) / 1000,
        boolean_f1_10: Math.round(boolF1_10 * 1000) / 1000,
        boolean_match_count: boolRes.count,
        relevant_found: relevantFound,
        non_relevant_found: nonRelevantFound,
        top_retrieved: retrieved.slice(0, 3).map((d) => `${d.doc_id} (${d.disease_name})`)
      });
    }

    const nQ = evalQueries.length;
    return {
      query_results: queryResults,
      mean_precision_at_5: Math.round((sumP5 / nQ) * 1000) / 1000,
      mean_precision_at_10: Math.round((sumP10 / nQ) * 1000) / 1000,
      mean_recall_at_10: Math.round((sumR10 / nQ) * 1000) / 1000,
      mean_f1_at_10: Math.round((sumF1_10 / nQ) * 1000) / 1000,
      mean_average_precision_MAP: Math.round((sumAp / nQ) * 1000) / 1000,
      mean_reciprocal_rank_MRR: Math.round((sumRr / nQ) * 1000) / 1000,
      boolean_mean_precision_at_10: Math.round((sumBoolP10 / nQ) * 1000) / 1000,
      boolean_mean_recall_at_10: Math.round((sumBoolR10 / nQ) * 1000) / 1000,
      boolean_mean_f1_at_10: Math.round((sumBoolF1_10 / nQ) * 1000) / 1000,
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
