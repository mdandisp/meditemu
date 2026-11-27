import type { Metadata } from "next";
import { getMedicalIREngine } from "@/lib/ir-engine";

export const metadata: Metadata = {
  title: "Evaluasi 10 Query, MAP & MRR | MediTemu",
  description:
    "Hasil benchmark evaluasi Precision@5, Precision@10, Recall@10, MAP, dan MRR pada korpus 135 dokumen medis MedlinePlus."
};

export default function EvaluasiPage() {
  const engine = getMedicalIREngine();
  const evalData = engine.runSystemEvaluation();

  const maxP10 = Math.max(
    0.4,
    ...evalData.query_results.flatMap((r) => [r.vsm_p10, r.bm25_p10, r.boolean_p10])
  );
  const yCeiling = Math.ceil(maxP10 * 10) / 10;

  const cardClass =
    "mb-5 rounded-[18px] border border-border bg-surface p-5 shadow-[var(--shadow-soft-sm)]";
  const kpiCardClass =
    "rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-soft-sm)]";

  return (
    <div>
      <section className={cardClass}>
        <h1 className="m-0 mb-1.5 font-heading text-[22px] font-bold text-ink-strong">
          Evaluasi Kualitas Information Retrieval (10 Query Uji Klinis)
        </h1>
        <p className="m-0 text-[14.5px] text-muted-foreground">
          Dihitung langsung terhadap seluruh koleksi <strong>{engine.N} dokumen medis MedlinePlus</strong> menggunakan penilaian relevansi (<em>Relevance Judgment</em>) berbasis diagnosis banding klinis, lengkap dengan perbandingan model <strong>VSM TF-IDF vs Okapi BM25 vs Boolean (OR &amp; AND)</strong> serta eksperimen pengaruh <em>preprocessing</em>.
        </p>
      </section>

      <section className={cardClass}>
        <h2 className="m-0 mb-2 font-heading text-[17px] font-bold text-ink-strong">
          Kriteria Penilaian Relevansi (<em>Relevance Judgment Criteria</em>)
        </h2>
        <p className="m-0 text-sm leading-relaxed text-foreground">
          Setiap pasangan <em>(Query, Dokumen)</em> dinilai secara biner oleh kurator: <strong>Relevan (1)</strong> apabila penyakit pada dokumen merupakan diagnosis banding klinis utama yang memiliki irisan gejala khas langsung dengan kueri uji (mengacu panduan MedlinePlus / WHO); dan <strong>Tidak Relevan (0)</strong> apabila gejala hanya muncul sebagai keluhan penyerta umum yang tidak spesifik terhadap skenario kueri tersebut.
        </p>
      </section>

      <section
        className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        aria-label="Ringkasan Metrik Evaluasi VSM"
      >
        <div className={kpiCardClass}>
          <div className="mb-1.5 text-[13px] font-semibold text-muted-foreground">Mean Precision @ 5 (VSM)</div>
          <div className="font-heading text-[26px] font-bold text-primary">
            {(evalData.mean_precision_at_5 * 100).toFixed(1)}%
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            BM25: {(evalData.bm25_mean_precision_at_5 * 100).toFixed(1)}%
          </div>
        </div>
        <div className={kpiCardClass}>
          <div className="mb-1.5 text-[13px] font-semibold text-muted-foreground">Mean Precision @ 10 (VSM)</div>
          <div className="font-heading text-[26px] font-bold text-primary">
            {(evalData.mean_precision_at_10 * 100).toFixed(1)}%
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            BM25: {(evalData.bm25_mean_precision_at_10 * 100).toFixed(1)}%
          </div>
        </div>
        <div className={kpiCardClass}>
          <div className="mb-1.5 text-[13px] font-semibold text-muted-foreground">Mean Recall @ 10 (VSM)</div>
          <div className="font-heading text-[26px] font-bold text-primary">
            {(evalData.mean_recall_at_10 * 100).toFixed(1)}%
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            BM25: {(evalData.bm25_mean_recall_at_10 * 100).toFixed(1)}%
          </div>
        </div>
        <div className={kpiCardClass}>
          <div className="mb-1.5 text-[13px] font-semibold text-muted-foreground">MAP (VSM / BM25)</div>
          <div className="font-heading text-[26px] font-bold text-accent">
            {evalData.mean_average_precision_MAP.toFixed(3)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            BM25: {evalData.bm25_MAP.toFixed(3)}
          </div>
        </div>
        <div className={kpiCardClass}>
          <div className="mb-1.5 text-[13px] font-semibold text-muted-foreground">MRR (VSM / BM25)</div>
          <div className="font-heading text-[26px] font-bold text-accent">
            {evalData.mean_reciprocal_rank_MRR.toFixed(3)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            BM25: {evalData.bm25_MRR.toFixed(3)}
          </div>
        </div>
      </section>

      {/* PERBANDINGAN RINGKAS MODEL IR */}
      <section className={cardClass}>
        <h2 className="m-0 mb-3 font-heading text-lg font-bold text-ink-strong">
          Perbandingan Performa Model: Boolean Retrieval vs VSM (TF-IDF) vs Okapi BM25
        </h2>
        <div className="table-scroll mb-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model Retrieval</th>
                <th>Mean P@5</th>
                <th>Mean P@10</th>
                <th>Mean R@10</th>
                <th>Mean F1@10</th>
                <th>MAP</th>
                <th>MRR</th>
                <th>Catatan Perilaku</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Vector Space Model (TF-IDF Cosine)</strong></td>
                <td>{evalData.mean_precision_at_5.toFixed(3)}</td>
                <td>{evalData.mean_precision_at_10.toFixed(3)}</td>
                <td>{evalData.mean_recall_at_10.toFixed(3)}</td>
                <td>{evalData.mean_f1_at_10.toFixed(3)}</td>
                <td><strong>{evalData.mean_average_precision_MAP.toFixed(3)}</strong></td>
                <td><strong>{evalData.mean_reciprocal_rank_MRR.toFixed(3)}</strong></td>
                <td className="text-xs">Normalisasi panjang dokumen ||D|| &amp; pembobotan TF-IDF konsisten menempatkan diagnosis relevan di peringkat teratas.</td>
              </tr>
              <tr>
                <td><strong>Okapi BM25 (k1=1.5, b=0.75)</strong></td>
                <td>{evalData.bm25_mean_precision_at_5.toFixed(3)}</td>
                <td>{evalData.bm25_mean_precision_at_10.toFixed(3)}</td>
                <td>{evalData.bm25_mean_recall_at_10.toFixed(3)}</td>
                <td>{evalData.bm25_mean_f1_at_10.toFixed(3)}</td>
                <td><strong>{evalData.bm25_MAP.toFixed(3)}</strong></td>
                <td><strong>{evalData.bm25_MRR.toFixed(3)}</strong></td>
                <td className="text-xs">Saturasi frekuensi term (k1) dan penalti panjang dokumen terhadap rata-rata korpus (b).</td>
              </tr>
              <tr>
                <td><strong>Boolean Retrieval (OR Unranked)</strong></td>
                <td>-</td>
                <td>{evalData.boolean_mean_precision_at_10.toFixed(3)}</td>
                <td>{evalData.boolean_mean_recall_at_10.toFixed(3)}</td>
                <td>{evalData.boolean_mean_f1_at_10.toFixed(3)}</td>
                <td>-</td>
                <td>-</td>
                <td className="text-xs">Mengembalikan terlalu banyak dokumen tanpa skor peringkat (himpunan biner 1/0 diurutkan berdasarkan ID).</td>
              </tr>
              <tr>
                <td><strong>Boolean Retrieval (AND Ketat)</strong></td>
                <td>-</td>
                <td>{evalData.boolean_and_mean_precision_at_10.toFixed(3)}</td>
                <td>{evalData.boolean_and_mean_recall_at_10.toFixed(3)}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td className="text-xs">
                  <strong>{evalData.boolean_and_zero_recall_queries} dari {evalData.total_queries_tested} query</strong> menghasilkan 0 dokumen (<em>zero recall</em>) karena seluruh kata wajib muncul bersamaan.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="m-0 mb-3 font-heading text-base font-bold text-ink-strong">
          Grafik Precision@10 per Query: VSM vs Okapi BM25 vs Boolean (OR)
        </h3>
        <div className="mb-5 overflow-x-auto rounded-xl border border-border bg-surface p-4">
          <svg
            viewBox="0 0 760 250"
            width="100%"
            className="max-h-[270px] min-w-[580px]"
            role="img"
            aria-labelledby="eval-chart-title"
          >
            <title id="eval-chart-title">
              Grafik batang perbandingan Precision@10 antara model VSM TF-IDF, Okapi BM25, dan Boolean Retrieval untuk kueri Q01 hingga Q10
            </title>

            {/* Legend */}
            <rect x="44" y="10" width="14" height="14" fill="var(--color-secondary)" rx="2" />
            <text x="64" y="21" fontSize="12" fontWeight="600" fill="var(--color-ink-strong)">
              VSM (TF-IDF Cosine)
            </text>
            <rect x="210" y="10" width="14" height="14" fill="var(--color-accent)" rx="2" />
            <text x="230" y="21" fontSize="12" fontWeight="600" fill="var(--color-ink-strong)">
              Okapi BM25
            </text>
            <rect
              x="335"
              y="10"
              width="14"
              height="14"
              fill="var(--color-chart-slate)"
              stroke="var(--color-muted-foreground)"
              strokeWidth="1.5"
              rx="2"
            />
            <text x="355" y="21" fontSize="12" fontWeight="600" fill="var(--color-ink-strong)">
              Boolean Retrieval (OR Unranked)
            </text>

            {/* Y-Axis Gridlines */}
            <line x1="44" y1="50" x2="740" y2="50" stroke="var(--color-chart-grid)" strokeDasharray="4" />
            <text x="8" y="54" fontSize="11" fill="var(--color-muted-foreground)">{yCeiling.toFixed(2)}</text>
            <line x1="44" y1="125" x2="740" y2="125" stroke="var(--color-chart-grid)" strokeDasharray="4" />
            <text x="8" y="129" fontSize="11" fill="var(--color-muted-foreground)">{(yCeiling / 2).toFixed(2)}</text>
            <line x1="44" y1="200" x2="740" y2="200" stroke="var(--color-chart-axis)" />
            <text x="8" y="204" fontSize="11" fill="var(--color-muted-foreground)">0.00</text>

            {evalData.query_results.map((row, idx) => {
              const xBase = 56 + idx * 68;
              const maxH = 150;
              const hVsm = Math.max(2, Math.round((row.vsm_p10 / yCeiling) * maxH));
              const hBm = Math.max(2, Math.round((row.bm25_p10 / yCeiling) * maxH));
              const hBool = Math.max(2, Math.round((row.boolean_p10 / yCeiling) * maxH));
              return (
                <g key={row.qid}>
                  <rect x={xBase} y={200 - hVsm} width="16" height={hVsm} fill="var(--color-secondary)" rx="3" />
                  <text x={xBase + 8} y={194 - hVsm} fontSize="9.5" fontWeight="700" textAnchor="middle" fill="var(--color-secondary)">
                    {row.vsm_p10.toFixed(1)}
                  </text>

                  <rect x={xBase + 18} y={200 - hBm} width="16" height={hBm} fill="var(--color-accent)" rx="3" />
                  <text x={xBase + 26} y={194 - hBm} fontSize="9.5" fontWeight="700" textAnchor="middle" fill="var(--color-accent)">
                    {row.bm25_p10.toFixed(1)}
                  </text>

                  <rect
                    x={xBase + 36}
                    y={200 - hBool}
                    width="16"
                    height={hBool}
                    fill="var(--color-chart-slate)"
                    stroke="var(--color-muted-foreground)"
                    strokeWidth="1"
                    rx="3"
                  />
                  <text x={xBase + 44} y={194 - hBool} fontSize="9.5" fontWeight="600" textAnchor="middle" fill="var(--color-muted-foreground)">
                    {row.boolean_p10.toFixed(1)}
                  </text>

                  <text x={xBase + 26} y="222" fontSize="11.5" fontWeight="700" textAnchor="middle" fill="var(--color-ink-strong)">
                    {row.qid}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <h3 className="m-0 mb-3 font-heading text-base font-bold text-ink-strong">
          Rincian Hasil Pengujian, Ground Truth &amp; Analisis Relevan vs Tidak Relevan
        </h3>
        <div className="table-scroll mb-[18px]">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Query Pengujian</th>
                <th>Ground Truth IDs</th>
                <th>VSM P@5 / P@10</th>
                <th>VSM R@10</th>
                <th>VSM AP / RR</th>
                <th>BM25 P@10 / MAP</th>
                <th>Bool OR / AND (Jml)</th>
                <th>Relevan Ditemukan (VSM)</th>
                <th>Tidak Relevan (Top-5 Noise)</th>
              </tr>
            </thead>
            <tbody>
              {evalData.query_results.map((q) => (
                <tr key={q.qid}>
                  <td><strong>{q.qid}</strong></td>
                  <td>{q.query}</td>
                  <td><code className="mono-code">{q.ground_truth_ids.join(", ")}</code></td>
                  <td>{q.vsm_p5.toFixed(2)} / <strong>{q.vsm_p10.toFixed(2)}</strong></td>
                  <td>{q.vsm_r10.toFixed(2)}</td>
                  <td>{q.vsm_ap.toFixed(2)} / {q.vsm_rr.toFixed(2)}</td>
                  <td>{q.bm25_p10.toFixed(2)} / {q.bm25_ap.toFixed(2)}</td>
                  <td className="text-xs">
                    OR: {q.boolean_p10.toFixed(2)} ({q.boolean_match_count})<br />
                    AND: {q.boolean_and_p10.toFixed(2)} ({q.boolean_and_match_count})
                  </td>
                  <td className="min-w-[180px] text-xs">
                    {q.relevant_found.join(" | ") || "-"}
                  </td>
                  <td className="min-w-[180px] text-xs text-muted-foreground">
                    {q.non_relevant_found.slice(0, 2).join(" | ") || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-border-brand bg-primary-soft px-5 py-4 text-sm leading-relaxed text-foreground">
          <strong>Analisis Hasil Evaluasi &amp; Keterbatasan:</strong>
          <ul className="mt-2 mb-0 list-disc pl-5">
            <li>
              <strong>Mengapa Dokumen Tidak Relevan Bisa Masuk Top-5 (Error Analysis):</strong> Pada gejala umum seperti <em>&ldquo;demam&rdquo;</em>, <em>&ldquo;mual&rdquo;</em>, atau <em>&ldquo;sakit kepala&rdquo;</em>, dokumen penyakit lain dengan panjang teks lebih pendek (norma ||D|| kecil) atau variasi istilah sinonim (<em>vocabulary mismatch</em>, mis. pada Q09 <em>&ldquo;pusing berputar&rdquo;</em> vs istilah klinis Migrain <em>&ldquo;sakit kepala berdenyut&rdquo;</em>) memengaruhi peringkat Top-5.
            </li>
            <li>
              <strong>Perbandingan Boolean Retrieval vs VSM vs BM25:</strong> VSM (TF-IDF) dan BM25 unggul jauh pada metrik <strong>MAP</strong> dan <strong>MRR</strong> karena melakukan pemeringkatan berdasar bobot kemiripan. Sebaliknya, Boolean <code>OR</code> mengembalikan terlalu banyak dokumen (rata-rata puluhan dokumen tanpa peringkat), sedangkan Boolean <code>AND</code> ketat menghasilkan 0 dokumen (<em>zero recall</em>) pada {evalData.boolean_and_zero_recall_queries} dari {evalData.total_queries_tested} query uji.
            </li>
            <li>
              <strong>Keterbatasan Penilaian Relevansi:</strong> Penilaian relevansi dibatasi pada 2&ndash;3 diagnosis banding klinis utama per kueri uji dari total {engine.N} dokumen, sehingga batas atas teoritis Precision@10 untuk 2 dokumen relevan adalah 0.20 (2/10). Oleh karena itu, Recall@10, MAP, dan MRR menjadi indikator kualitas pemeringkatan yang paling representatif.
            </li>
          </ul>
        </div>
      </section>

      {/* EKSPERIMEN PENGARUH PREPROCESSING (ABLATION STUDY) */}
      <section className={cardClass}>
        <h2 className="m-0 mb-2 font-heading text-lg font-bold text-ink-strong">
          Eksperimen Tambahan: Analisis Pengaruh Preprocessing (Ablation Study)
        </h2>
        <p className="m-0 mb-3.5 text-sm text-muted-foreground">
          Mengukur dampak nyata setiap komponen <em>text preprocessing</em> terhadap ukuran kosakata indeks (|V|) serta metrik efektivitas VSM pada 10 query uji yang sama:
        </p>
        <div className="table-scroll mb-3.5">
          <table className="data-table">
            <thead>
              <tr>
                <th>Skenario Preprocessing</th>
                <th>Kosakata |V|</th>
                <th>Avg Panjang Dok</th>
                <th>Mean P@5</th>
                <th>Mean P@10</th>
                <th>Mean R@10</th>
                <th>MAP</th>
                <th>MRR</th>
              </tr>
            </thead>
            <tbody>
              {evalData.preprocessing_ablation.map((sc) => (
                <tr key={sc.scenario_id}>
                  <td>
                    <strong>{sc.label}</strong>
                    <div className="text-xs text-muted-foreground">{sc.description}</div>
                  </td>
                  <td>{sc.vocabulary_size}</td>
                  <td>{sc.avg_doc_length}</td>
                  <td>{sc.mean_p5.toFixed(3)}</td>
                  <td>{sc.mean_p10.toFixed(3)}</td>
                  <td>{sc.mean_r10.toFixed(3)}</td>
                  <td><strong>{sc.map.toFixed(3)}</strong></td>
                  <td><strong>{sc.mrr.toFixed(3)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
