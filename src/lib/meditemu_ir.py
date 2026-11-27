from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from ir_engine import MedicalIREngine, get_medical_ir_engine
from preprocessing import inspect_preprocessing_steps, preprocess_text


def run_http_server(engine: MedicalIREngine, host: str = "127.0.0.1", port: int = 8000) -> None:
    class MediTemuHandler(BaseHTTPRequestHandler):
        def _send_json(self, status: int, payload: Any) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self) -> None:
            self._send_json(200, {"ok": True})

        def do_GET(self) -> None:
            try:
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)

                if parsed.path == "/health":
                    self._send_json(200, {"status": "ok", "documents": engine.N, "engine": "python"})
                    return

                if parsed.path == "/api/search":
                    q = qs.get("q", [""])[0]
                    method = qs.get("method", ["vsm"])[0]
                    if method not in ("vsm", "boolean", "bm25"):
                        self._send_json(400, {"error": f"Metode tidak valid: {method}"})
                        return

                    topk_raw = qs.get("topk", ["10"])[0] or "10"
                    try:
                        topk = int(topk_raw)
                    except ValueError:
                        self._send_json(400, {"error": f"Parameter topk harus berupa angka: {topk_raw}"})
                        return
                    topk = max(1, min(topk, 100))

                    category = qs.get("category", ["Semua Kategori"])[0]
                    doc_id = qs.get("doc_id", [""])[0]

                    if method == "boolean":
                        bool_res = engine.search_boolean(q, category)
                        self._send_json(200, {"engine": "python", "method": "boolean", "boolean": bool_res, "results": []})
                        return

                    if not q.strip():
                        self._send_json(
                            200,
                            {
                                "engine": "python",
                                "method": method,
                                "results": [],
                                "xray": None,
                                "xray_top3": [],
                            },
                        )
                        return

                    results = (
                        engine.search_bm25(q, topk, category)
                        if method == "bm25"
                        else engine.search_vsm(q, topk, category)
                    )
                    target_id = doc_id or (results[0]["doc_id"] if results else "")
                    xray = engine.get_manual_calculation_steps(q, target_id) if target_id else None
                    top3_ids = [r["doc_id"] for r in engine.search_vsm(q, 3, category)]
                    xray_top3 = [engine.get_manual_calculation_steps(q, did) for did in top3_ids]
                    self._send_json(
                        200,
                        {
                            "engine": "python",
                            "method": method,
                            "results": results,
                            "xray": xray,
                            "xray_top3": [x for x in xray_top3 if x is not None],
                        },
                    )
                    return

                if parsed.path == "/api/manual":
                    q = qs.get("q", [""])[0]
                    doc_id = qs.get("doc_id", ["MED-001"])[0]
                    breakdown = engine.get_manual_calculation_steps(q, doc_id)
                    if breakdown is None:
                        self._send_json(404, {"error": f"Dokumen tidak ditemukan: {doc_id}"})
                        return
                    self._send_json(200, breakdown)
                    return

                if parsed.path == "/api/preprocess":
                    text = qs.get("text", [""])[0]
                    self._send_json(200, inspect_preprocessing_steps(text))
                    return

                if parsed.path == "/api/evaluate":
                    self._send_json(200, engine.run_system_evaluation())
                    return

                self._send_json(404, {"error": "Endpoint not found"})
            except Exception as exc:
                self._send_json(500, {"error": f"Internal server error: {exc}"})

        def log_message(self, format: str, *args: Any) -> None:
            pass

    server = ThreadingHTTPServer((host, port), MediTemuHandler)
    print(f"MediTemu Python IR Backend aktif di http://{host}:{port} ({engine.N} dokumen)")
    server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="MediTemu Standalone Python IR Engine")
    parser.add_argument("--query", "-q", type=str, default="demam batuk", help="Query gejala medis")
    parser.add_argument("--method", "-m", choices=["vsm", "boolean", "bm25"], default="vsm")
    parser.add_argument("--topk", "-k", type=int, default=5)
    parser.add_argument("--eval", action="store_true", help="Jalankan evaluasi 10 query uji")
    parser.add_argument("--serve", action="store_true", help="Jalankan HTTP API backend di port 8000")
    parser.add_argument("--port", type=int, default=8000, help="Port HTTP server (default: 8000)")
    args = parser.parse_args()

    engine = get_medical_ir_engine()

    if args.serve:
        run_http_server(engine, port=args.port)
        return

    print(f"Korpus dimuat: {engine.N} dokumen MedlinePlus ({len(engine.df)} term unik)\n")

    if args.eval:
        summary = engine.run_system_evaluation()
        print("Hasil Evaluasi Sistem (10 Query):")
        for k in (
            "total_documents",
            "total_queries_tested",
            "mean_precision_at_5",
            "mean_precision_at_10",
            "mean_recall_at_10",
            "mean_f1_at_10",
            "mean_average_precision_MAP",
            "mean_reciprocal_rank_MRR",
        ):
            print(f"  {k}: {summary[k]}")
        return

    if args.method == "boolean":
        res = engine.search_boolean(args.query)
        print(f"Query Boolean : {res['query']}")
        print(f"Postfix       : {res['postfix_expression']}")
        print(f"Total Cocok   : {res['count']} dokumen")
        for doc in res["matches"][: args.topk]:
            print(f"  - {doc['doc_id']} | {doc['disease_name']} | {doc['source_url']}")
    elif args.method == "bm25":
        results = engine.search_bm25(args.query, top_k=args.topk)
        print(f"Query BM25    : {args.query}")
        print(f"Token bersih  : {preprocess_text(args.query)}")
        for idx, r in enumerate(results, 1):
            print(f"  #{idx:02d} {r['doc_id']} ({r['score']:.4f}) | {r['disease_name']}")
    else:
        results = engine.search_vsm(args.query, top_k=args.topk)
        print(f"Query VSM     : {args.query}")
        print(f"Token bersih  : {preprocess_text(args.query)}")
        for idx, r in enumerate(results, 1):
            print(f"  #{idx:02d} {r['doc_id']} ({r['score']:.4f}) | {r['disease_name']}")


if __name__ == "__main__":
    main()
