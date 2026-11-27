from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from ir_types import (
    BooleanSearchResponse,
    EvalQueryResult,
    ManualCalculationBreakdown,
    ManualTermDetail,
    MedicalDocument,
    SearchResult,
    SystemEvaluationSummary,
    UrgencyLevel,
)
from preprocessing import preprocess_text, stem_token

RED_FLAG_TERMS: list[str] = [
    "jantung", "infark", "tidak sadar", "hilang kesadaran", "pingsan",
    "muntah darah", "stroke", "lumpuh separuh", "kejang", "sesak berat",
    "bibir biru", "keracunan", "meningitis", "kaku kuduk", "koma", "nyeri dada sebelah kiri",
]

URGENCY_WEIGHT: dict[UrgencyLevel, int] = {
    "Darurat": 3,
    "Sedang": 2,
    "Ringan": 1,
}


def check_emergency_red_flags(query: str) -> bool:
    q_lower = query.lower()
    return any(term in q_lower for term in RED_FLAG_TERMS)


class MedicalIREngine:
    def __init__(self, dataset_path: Path | None = None) -> None:
        if dataset_path is None:
            dataset_path = Path(__file__).resolve().parent.parent / "data" / "medical_dataset.json"

        self.documents: list[MedicalDocument] = json.loads(dataset_path.read_text(encoding="utf-8"))
        self.N: int = len(self.documents)
        self.k1: float = 1.5
        self.b: float = 0.75

        self.doc_map: dict[str, MedicalDocument] = {}
        self.inverted_index: dict[str, set[str]] = {}
        self.doc_tokens: dict[str, list[str]] = {}
        self.doc_tf: dict[str, dict[str, int]] = {}
        self.doc_len: dict[str, int] = {}
        self.df: dict[str, int] = {}
        self.idf: dict[str, float] = {}
        self.doc_vectors: dict[str, dict[str, float]] = {}
        self.doc_norms: dict[str, float] = {}

        total_len = 0
        for doc in self.documents:
            doc_id = doc["doc_id"]
            self.doc_map[doc_id] = doc
            search_content = (
                f"{doc['disease_name']} {doc['disease_name']} {doc['source_title']} "
                f"{doc['symptoms']} {doc['symptoms']} {doc['category']} {doc['description']}"
            )
            tokens = preprocess_text(search_content)
            self.doc_tokens[doc_id] = tokens
            self.doc_len[doc_id] = len(tokens)
            total_len += len(tokens)

            tf_counter: dict[str, int] = {}
            for t in tokens:
                tf_counter[t] = tf_counter.get(t, 0) + 1
            self.doc_tf[doc_id] = tf_counter

            for term in set(tokens):
                self.inverted_index.setdefault(term, set()).add(doc_id)
                self.df[term] = self.df.get(term, 0) + 1

        self.avg_doc_len: float = total_len / max(self.N, 1)

        # IDF = log10(N / DF_t) + 1.0
        for term, doc_freq in self.df.items():
            self.idf[term] = math.log10(self.N / doc_freq) + 1.0

        # Document vectors & Euclidean norms
        for doc_id, tf_map in self.doc_tf.items():
            vec: dict[str, float] = {}
            sum_sq = 0.0
            for term, count in tf_map.items():
                weight = count * self.idf.get(term, 0.0)
                vec[term] = weight
                sum_sq += weight * weight
            self.doc_vectors[doc_id] = vec
            self.doc_norms[doc_id] = math.sqrt(sum_sq)

    def get_categories(self) -> list[str]:
        return sorted({doc["category"] for doc in self.documents})

    # ==========================================
    # MODEL 1: BOOLEAN RETRIEVAL (SHUNTING-YARD)
    # ==========================================
    def parse_boolean_query_to_postfix(self, query: str) -> list[str]:
        cleaned = re.sub(r" dan ", " AND ", query, flags=re.IGNORECASE)
        cleaned = re.sub(r" atau ", " OR ", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r" bukan ", " NOT ", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r" tidak ", " NOT ", cleaned, flags=re.IGNORECASE)

        raw_tokens = preprocess_text(cleaned, preserve_boolean=True)
        normalized_tokens: list[str] = []
        for tok in raw_tokens:
            upper = tok.upper()
            is_binary_op = upper in ("AND", "OR")
            if normalized_tokens:
                prev_upper = normalized_tokens[-1].upper()
                prev_is_operand_or_close = prev_upper not in ("(", "AND", "OR", "NOT")
                curr_needs_implicit_and = (upper == "NOT") or (not is_binary_op and tok != ")")
                if prev_is_operand_or_close and curr_needs_implicit_and:
                    normalized_tokens.append("AND")
            normalized_tokens.append(tok)

        precedence = {"NOT": 3, "AND": 2, "OR": 1}
        output: list[str] = []
        op_stack: list[str] = []

        for token in normalized_tokens:
            upper = token.upper()
            if upper in precedence:
                while (
                    op_stack
                    and op_stack[-1] != "("
                    and precedence.get(op_stack[-1], 0) >= precedence[upper]
                ):
                    output.append(op_stack.pop())
                op_stack.append(upper)
            elif token == "(":
                op_stack.append("(")
            elif token == ")":
                while op_stack and op_stack[-1] != "(":
                    output.append(op_stack.pop())
                if op_stack and op_stack[-1] == "(":
                    op_stack.pop()
            else:
                output.append(stem_token(token.lower()))

        while op_stack:
            output.append(op_stack.pop())
        return output

    def search_boolean(self, query: str, category_filter: str | None = None) -> BooleanSearchResponse:
        all_docs = set(self.doc_map.keys())
        postfix = self.parse_boolean_query_to_postfix(query)
        if not postfix:
            return {
                "query": query,
                "postfix_expression": [],
                "matches": [],
                "count": 0,
                "limitation_note": "Kueri kosong atau seluruh kata tereliminasi sebagai stopwords.",
            }

        eval_stack: list[set[str]] = []
        for token in postfix:
            if token == "NOT":
                operand = eval_stack.pop() if eval_stack else set()
                eval_stack.append(all_docs - operand)
            elif token == "AND":
                right = eval_stack.pop() if eval_stack else set()
                left = eval_stack.pop() if eval_stack else set()
                eval_stack.append(left & right)
            elif token == "OR":
                right = eval_stack.pop() if eval_stack else set()
                left = eval_stack.pop() if eval_stack else set()
                eval_stack.append(left | right)
            else:
                eval_stack.append(set(self.inverted_index.get(token, set())))

        result_ids = sorted(eval_stack.pop() if eval_stack else set())
        matches = [self.doc_map[doc_id] for doc_id in result_ids]
        if category_filter and category_filter != "Semua Kategori":
            matches = [m for m in matches if m["category"] == category_filter]
        return {
            "query": query,
            "postfix_expression": postfix,
            "matches": matches,
            "count": len(matches),
            "limitation_note": (
                "Keterbatasan Boolean Retrieval: Hasil bersifat unranked (tanpa skor relevansi). "
                "Dokumen bernilai biner (hanya 1 atau 0), sehingga tidak dapat mengurutkan penyakit "
                "berdasarkan tingkat kemiripan."
            ),
        }

    # ==========================================
    # MODEL 2: VECTOR SPACE MODEL (VSM TF-IDF)
    # ==========================================
    def search_vsm(
        self, query: str, top_k: int = 10, category_filter: str | None = None
    ) -> list[SearchResult]:
        q_tokens = preprocess_text(query)
        if not q_tokens:
            return []

        q_tf: dict[str, int] = {}
        for t in q_tokens:
            q_tf[t] = q_tf.get(t, 0) + 1

        q_vector: dict[str, float] = {}
        q_sum_sq = 0.0
        for term, count in q_tf.items():
            term_idf = self.idf.get(term, 0.0)
            if term_idf > 0:
                w = count * term_idf
                q_vector[term] = w
                q_sum_sq += w * w

        q_norm = math.sqrt(q_sum_sq)
        if q_norm == 0:
            return []

        scored: list[dict[str, Any]] = []
        for doc in self.documents:
            if category_filter and category_filter != "Semua Kategori" and doc["category"] != category_filter:
                continue
            doc_id = doc["doc_id"]
            d_vector = self.doc_vectors.get(doc_id, {})
            d_norm = self.doc_norms.get(doc_id, 0.0)
            if d_norm == 0:
                continue

            dot_product = 0.0
            overlap: list[str] = []
            for term, wq in q_vector.items():
                if term in d_vector:
                    dot_product += wq * d_vector[term]
                    overlap.append(term)

            if dot_product > 0:
                cosine_sim = dot_product / (q_norm * d_norm)
                scored.append(
                    {
                        **doc,
                        "score": round(cosine_sim, 5),
                        "score_percentage": round(cosine_sim * 1000) / 10,
                        "overlap_terms": overlap,
                        "overlap_count": len(overlap),
                        "urgency_weight": URGENCY_WEIGHT.get(doc["urgency_level"], 1),
                        "tie_breaker_used": False,
                    }
                )

        scored.sort(
            key=lambda x: (-x["score"], -x["overlap_count"], -x["urgency_weight"], x["doc_id"])
        )
        for i in range(len(scored) - 1):
            if scored[i]["score"] == scored[i + 1]["score"]:
                scored[i]["tie_breaker_used"] = True
                scored[i + 1]["tie_breaker_used"] = True

        results: list[SearchResult] = []
        for idx, item in enumerate(scored[:top_k], 1):
            clean_item = {k: v for k, v in item.items() if k != "urgency_weight"}
            clean_item["rank"] = idx
            results.append(clean_item)  # type: ignore[arg-type]
        return results

    # ==========================================
    # MODEL BONUS: OKAPI BM25
    # ==========================================
    def search_bm25(
        self, query: str, top_k: int = 10, category_filter: str | None = None
    ) -> list[SearchResult]:
        q_tokens = preprocess_text(query)
        if not q_tokens:
            return []

        scored: list[dict[str, Any]] = []
        for doc in self.documents:
            if category_filter and category_filter != "Semua Kategori" and doc["category"] != category_filter:
                continue
            doc_id = doc["doc_id"]
            d_len = self.doc_len.get(doc_id, 0)
            d_tf = self.doc_tf.get(doc_id, {})
            bm25_score = 0.0
            overlap_set: set[str] = set()

            for term in q_tokens:
                freq = d_tf.get(term, 0)
                if freq > 0:
                    idf_val = self.idf.get(term, 0.0)
                    num = freq * (self.k1 + 1)
                    den = freq + self.k1 * (1 - self.b + self.b * (d_len / self.avg_doc_len))
                    bm25_score += idf_val * (num / den)
                    overlap_set.add(term)

            if bm25_score > 0:
                overlap_terms = list(overlap_set)
                scored.append(
                    {
                        **doc,
                        "score": round(bm25_score, 4),
                        "score_percentage": min(99.9, round((bm25_score / 15) * 1000) / 10),
                        "overlap_terms": overlap_terms,
                        "overlap_count": len(overlap_terms),
                        "tie_breaker_used": False,
                    }
                )

        scored.sort(key=lambda x: (-x["score"], -x["overlap_count"], x["doc_id"]))
        for idx, item in enumerate(scored[:top_k], 1):
            item["rank"] = idx
        return scored[:top_k]  # type: ignore[return-value]

    # ==========================================
    # X-RAY PERHITUNGAN MANUAL
    # ==========================================
    def get_manual_calculation_steps(self, query: str, doc_id: str) -> ManualCalculationBreakdown | None:
        doc = self.doc_map.get(doc_id)
        if not doc:
            return None

        q_tokens = preprocess_text(query)
        q_tf: dict[str, int] = {}
        for t in q_tokens:
            q_tf[t] = q_tf.get(t, 0) + 1

        d_tf = self.doc_tf.get(doc_id, {})
        terms_detail: list[ManualTermDetail] = []
        dot_product = 0.0
        q_sum_sq = 0.0

        for term, tf_q in q_tf.items():
            tf_d = d_tf.get(term, 0)
            df_val = self.df.get(term, 0)
            idf_val = self.idf.get(term, 0.0)
            w_q = tf_q * idf_val
            w_d = tf_d * idf_val
            prod = w_q * w_d
            dot_product += prod
            q_sum_sq += w_q * w_q

            terms_detail.append(
                {
                    "term": term,
                    "tf_query": tf_q,
                    "tf_doc": tf_d,
                    "df": df_val,
                    "idf": round(idf_val, 4),
                    "w_query": round(w_q, 4),
                    "w_doc": round(w_d, 4),
                    "product_wq_wd": round(prod, 4),
                }
            )

        q_norm = math.sqrt(q_sum_sq)
        d_norm = self.doc_norms.get(doc_id, 0.0)
        denom = q_norm * d_norm
        cosine_sim = dot_product / denom if denom > 0 else 0.0

        return {
            "query_original": query,
            "query_preprocessed": q_tokens,
            "doc_id": doc_id,
            "disease_name": doc["disease_name"],
            "total_documents_N": self.N,
            "terms_detail": terms_detail,
            "dot_product_sum": round(dot_product, 4),
            "query_norm": round(q_norm, 4),
            "doc_norm": round(d_norm, 4),
            "denominator": round(denom, 4),
            "final_cosine_similarity": round(cosine_sim, 5),
            "final_percentage": round(cosine_sim * 100, 2),
        }

    # ==========================================
    # EVALUASI 10 QUERY BENCHMARK (MAP, MRR, F1)
    # ==========================================
    def run_system_evaluation(self) -> SystemEvaluationSummary:
        eval_queries = [
            ("Q01", "demam tinggi sakit kepala bintik merah", ["MED-001", "MED-004", "MED-007"], "Penyakit tropis dengan ruam dan demam tinggi"),
            ("Q02", "batuk kering sesak napas demam hilang penciuman", ["MED-006", "MED-018", "MED-016"], "Infeksi pernapasan akut dengan anosmia"),
            ("Q03", "nyeri dada sebelah kiri sesak napas keringat dingin", ["MED-026", "MED-027", "MED-028"], "Sindrom koroner akut / kegawatdaruratan jantung"),
            ("Q04", "sakit perut kanan bawah mual muntah demam", ["MED-038", "MED-039"], "Kegawatdaruratan perut kuadran kanan bawah"),
            ("Q05", "sering haus sering kencing berat badan turun", ["MED-081", "MED-082"], "Trias gejala klasik hiperglikemia diabetes"),
            ("Q06", "gatal bentol kemerahan setelah makan makanan laut", ["MED-071", "MED-072", "MED-078"], "Reaksi alergi makanan akut kulit dan sistemik"),
            ("Q07", "nyeri sendi bengkak kemerahan jempol kaki", ["MED-061", "MED-062"], "Radang sendi monoartikular akut podagra"),
            ("Q08", "mata kuning kulit kuning perut buncit lemas", ["MED-042", "MED-043", "MED-044"], "Disfungsi hepar / penyakit kuning & asites"),
            ("Q09", "pusing berputar sensasi melayang mual muntah", ["MED-051", "MED-052"], "Gangguan sistem vestibular keseimbangan"),
            ("Q10", "batuk dahak lama keringat malam berat turun", ["MED-016", "MED-018", "MED-020"], "Penyakit paru kronis curiga tuberkulosis"),
        ]

        query_results: list[EvalQueryResult] = []
        sum_p5 = sum_p10 = sum_r10 = sum_f1_10 = sum_ap = sum_rr = 0.0
        sum_bool_p10 = sum_bool_r10 = sum_bool_f1_10 = 0.0

        for qid, query, gt_list, intent in eval_queries:
            gt = set(gt_list)
            total_rel = len(gt)
            retrieved = self.search_vsm(query, 10)
            ids = [r["doc_id"] for r in retrieved]

            p5 = sum(1 for i in ids[:5] if i in gt) / 5.0
            rel10 = sum(1 for i in ids if i in gt)
            p10 = rel10 / 10.0
            r10 = rel10 / total_rel if total_rel > 0 else 0.0
            f1_10 = (2 * p10 * r10) / (p10 + r10) if (p10 + r10) > 0 else 0.0

            running_rel = 0
            prec_sum = 0.0
            first_rel = 0
            for idx, did in enumerate(ids):
                if did in gt:
                    running_rel += 1
                    prec_sum += running_rel / (idx + 1)
                    if first_rel == 0:
                        first_rel = idx + 1

            ap = prec_sum / total_rel if total_rel > 0 else 0.0
            rr = 1.0 / first_rel if first_rel > 0 else 0.0

            bool_res = self.search_boolean(query.replace(" ", " OR "))
            bool_ids = [d["doc_id"] for d in bool_res["matches"][:10]]
            bool_rel = sum(1 for i in bool_ids if i in gt)
            bool_p10 = bool_rel / max(len(bool_ids), 1)
            bool_r10 = bool_rel / total_rel if total_rel > 0 else 0.0
            bool_f1_10 = (2 * bool_p10 * bool_r10) / (bool_p10 + bool_r10) if (bool_p10 + bool_r10) > 0 else 0.0

            sum_p5 += p5
            sum_p10 += p10
            sum_r10 += r10
            sum_f1_10 += f1_10
            sum_ap += ap
            sum_rr += rr
            sum_bool_p10 += bool_p10
            sum_bool_r10 += bool_r10
            sum_bool_f1_10 += bool_f1_10

            query_results.append(
                {
                    "qid": qid,
                    "query": query,
                    "intent": intent,
                    "ground_truth_ids": gt_list,
                    "ground_truth_count": total_rel,
                    "vsm_p5": round(p5, 3),
                    "vsm_p10": round(p10, 3),
                    "vsm_r10": round(r10, 3),
                    "vsm_f1_10": round(f1_10, 3),
                    "vsm_ap": round(ap, 3),
                    "vsm_rr": round(rr, 3),
                    "boolean_p10": round(bool_p10, 3),
                    "boolean_r10": round(bool_r10, 3),
                    "boolean_f1_10": round(bool_f1_10, 3),
                    "boolean_match_count": bool_res["count"],
                    "relevant_found": [
                        f"#{d['rank']} {d['doc_id']} ({d['disease_name']})"
                        for d in retrieved
                        if d["doc_id"] in gt
                    ],
                    "non_relevant_found": [
                        f"#{d['rank']} {d['doc_id']} ({d['disease_name']})"
                        for d in retrieved[:5]
                        if d["doc_id"] not in gt
                    ],
                    "top_retrieved": [
                        f"{d['doc_id']} ({d['disease_name']})" for d in retrieved[:3]
                    ],
                }
            )

        n = len(eval_queries)
        return {
            "total_documents": self.N,
            "query_results": query_results,
            "mean_precision_at_5": round(sum_p5 / n, 3),
            "mean_precision_at_10": round(sum_p10 / n, 3),
            "mean_recall_at_10": round(sum_r10 / n, 3),
            "mean_f1_at_10": round(sum_f1_10 / n, 3),
            "mean_average_precision_MAP": round(sum_ap / n, 3),
            "mean_reciprocal_rank_MRR": round(sum_rr / n, 3),
            "boolean_mean_precision_at_10": round(sum_bool_p10 / n, 3),
            "boolean_mean_recall_at_10": round(sum_bool_r10 / n, 3),
            "boolean_mean_f1_at_10": round(sum_bool_f1_10 / n, 3),
            "total_queries_tested": n,
        }


_engine_instance: MedicalIREngine | None = None


def get_medical_ir_engine() -> MedicalIREngine:
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = MedicalIREngine()
    return _engine_instance
