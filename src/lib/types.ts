export type UrgencyLevel = "Darurat" | "Sedang" | "Ringan";

export interface MedicalDocument {
  doc_id: string;
  disease_name: string;
  category: string;
  symptoms: string;
  description: string;
  precaution: string;
  urgency_level: UrgencyLevel;
  source: string;
  source_id: string;
  source_title: string;
  source_url: string;
  source_excerpt: string;
  source_snapshot: string;
}

export type RetrievalModel = "vsm" | "boolean" | "bm25";

export interface SearchResult {
  rank: number;
  doc_id: string;
  disease_name: string;
  category: string;
  symptoms: string;
  description: string;
  precaution: string;
  urgency_level: UrgencyLevel;
  source: string;
  source_id: string;
  source_title: string;
  source_url: string;
  source_excerpt: string;
  source_snapshot: string;
  score: number;
  score_percentage: number;
  overlap_terms: string[];
  overlap_count: number;
  tie_breaker_used: boolean;
}

export interface BooleanSearchResponse {
  query: string;
  postfix_expression: string[];
  matches: MedicalDocument[];
  count: number;
  limitation_note: string;
  syntax_warning?: string;
}

export interface ManualTermDetail {
  term: string;
  tf_query: number;
  tf_doc: number;
  df: number;
  idf: number;
  w_query: number;
  w_doc: number;
  product_wq_wd: number;
}

export interface ManualCalculationBreakdown {
  query_original: string;
  query_preprocessed: string[];
  doc_id: string;
  disease_name: string;
  total_documents_N: number;
  doc_token_count: number;
  indexing_note: string;
  terms_detail: ManualTermDetail[];
  dot_product_sum: number;
  query_norm: number;
  doc_norm: number;
  denominator: number;
  final_cosine_similarity: number;
  final_percentage: number;
}

export interface PreprocessingSteps {
  original: string;
  case_folding: string;
  normalized: string;
  tokenized: string[];
  stopword_removed: string[];
  stemmed: string[];
  token_count_before: number;
  token_count_after: number;
}

export interface CorpusStats {
  total_documents: number;
  vocabulary_size: number;
  total_tokens: number;
  avg_doc_length: number;
  min_doc_length: number;
  max_doc_length: number;
  category_counts: Record<string, number>;
  urgency_counts: Record<UrgencyLevel, number>;
}

export interface EvalQueryResult {
  qid: string;
  query: string;
  intent: string;
  ground_truth_ids: string[];
  ground_truth_count: number;
  vsm_p5: number;
  vsm_p10: number;
  vsm_r10: number;
  vsm_f1_10: number;
  vsm_ap: number;
  vsm_rr: number;
  bm25_p5: number;
  bm25_p10: number;
  bm25_r10: number;
  bm25_f1_10: number;
  bm25_ap: number;
  bm25_rr: number;
  boolean_p10: number;
  boolean_r10: number;
  boolean_f1_10: number;
  boolean_match_count: number;
  boolean_and_p10: number;
  boolean_and_r10: number;
  boolean_and_match_count: number;
  relevant_found: string[];
  non_relevant_found: string[];
  top_retrieved: string[];
}

export interface PreprocessingAblationScenario {
  scenario_id: string;
  label: string;
  description: string;
  vocabulary_size: number;
  avg_doc_length: number;
  mean_p5: number;
  mean_p10: number;
  mean_r10: number;
  map: number;
  mrr: number;
}

export interface SystemEvaluationSummary {
  query_results: EvalQueryResult[];
  mean_precision_at_5: number;
  mean_precision_at_10: number;
  mean_recall_at_10: number;
  mean_f1_at_10: number;
  mean_average_precision_MAP: number;
  mean_reciprocal_rank_MRR: number;
  bm25_mean_precision_at_5: number;
  bm25_mean_precision_at_10: number;
  bm25_mean_recall_at_10: number;
  bm25_mean_f1_at_10: number;
  bm25_MAP: number;
  bm25_MRR: number;
  boolean_mean_precision_at_10: number;
  boolean_mean_recall_at_10: number;
  boolean_mean_f1_at_10: number;
  boolean_and_mean_precision_at_10: number;
  boolean_and_mean_recall_at_10: number;
  boolean_and_zero_recall_queries: number;
  preprocessing_ablation: PreprocessingAblationScenario[];
  total_queries_tested: number;
}
