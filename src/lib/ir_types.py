from __future__ import annotations

from typing import Literal, TypedDict

UrgencyLevel = Literal["Darurat", "Sedang", "Ringan"]
RetrievalModel = Literal["vsm", "boolean", "bm25"]


class MedicalDocument(TypedDict):
    doc_id: str
    disease_name: str
    category: str
    symptoms: str
    description: str
    precaution: str
    urgency_level: UrgencyLevel
    source: str
    source_id: str
    source_title: str
    source_url: str
    source_excerpt: str
    source_snapshot: str


class SearchResult(TypedDict):
    rank: int
    doc_id: str
    disease_name: str
    category: str
    symptoms: str
    description: str
    precaution: str
    urgency_level: UrgencyLevel
    source: str
    source_id: str
    source_title: str
    source_url: str
    source_excerpt: str
    source_snapshot: str
    score: float
    score_percentage: float
    overlap_terms: list[str]
    overlap_count: int
    tie_breaker_used: bool


class BooleanSearchResponse(TypedDict):
    query: str
    postfix_expression: list[str]
    matches: list[MedicalDocument]
    count: int
    limitation_note: str


class ManualTermDetail(TypedDict):
    term: str
    tf_query: int
    tf_doc: int
    df: int
    idf: float
    w_query: float
    w_doc: float
    product_wq_wd: float


class ManualCalculationBreakdown(TypedDict):
    query_original: str
    query_preprocessed: list[str]
    doc_id: str
    disease_name: str
    total_documents_N: int
    terms_detail: list[ManualTermDetail]
    dot_product_sum: float
    query_norm: float
    doc_norm: float
    denominator: float
    final_cosine_similarity: float
    final_percentage: float


class PreprocessingSteps(TypedDict):
    original: str
    case_folding: str
    normalized: str
    tokenized: list[str]
    stopword_removed: list[str]
    stemmed: list[str]
    token_count_before: int
    token_count_after: int


class EvalQueryResult(TypedDict):
    qid: str
    query: str
    intent: str
    ground_truth_ids: list[str]
    ground_truth_count: int
    vsm_p5: float
    vsm_p10: float
    vsm_r10: float
    vsm_f1_10: float
    vsm_ap: float
    vsm_rr: float
    boolean_p10: float
    boolean_r10: float
    boolean_f1_10: float
    boolean_match_count: int
    relevant_found: list[str]
    non_relevant_found: list[str]
    top_retrieved: list[str]


class SystemEvaluationSummary(TypedDict):
    total_documents: int
    query_results: list[EvalQueryResult]
    mean_precision_at_5: float
    mean_precision_at_10: float
    mean_recall_at_10: float
    mean_f1_at_10: float
    mean_average_precision_MAP: float
    mean_reciprocal_rank_MRR: float
    boolean_mean_precision_at_10: float
    boolean_mean_recall_at_10: float
    boolean_mean_f1_at_10: float
    total_queries_tested: int
