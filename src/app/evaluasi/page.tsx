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
          Dihitung langsung terhadap seluruh koleksi <strong>{engine.N} dokumen medis MedlinePlus</strong> menggunakan penilaian relevansi (<em>Relevance Judgment</em>) berbasis diagnosis banding klinis.
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
        className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6"
        aria-label="Ringkasan Metrik Evaluasi"
      >
        <div className={kpiCardClass}>
          <div className="mb-1.5 text-[13px] font-semibold text-muted-foreground">Mean Precision @ 5</div>
          <div className="font-heading text-[26px] font-bold text-primary">
            {(evalData.mean_precision_at_5 * 100).toFixed(1)}%
          </div>
        </div>
        <div className={kpiCardClass}>
          <div className="mb-1.5 text-[13px] font-semibold text-muted-foreground">Mean Precision @ 10</div>
          <div className="font-heading text-[26px] font-bold text-primary">
            {(evalData.mean_precision_at_10 * 100).toFixed(1)}%
          </div>
        </div>
        <div className={kpiCardClass}>
          <div className="mb-1.5 text-[13px] font-semibold text-muted-foreground">Mean Recall @ 10</div>
          <div className="font-heading text-[26px] font-bold text-primary">
            {(evalData.mean_recall_at_10 * 100).toFixed(1)}%
          </div>
        </div>
        <div className={kpiCardClass}>
          <div className="mb-1.5 text-[13px] font-semibold text-muted-foreground">Mean F1 @ 10</div>
          <div className="font-heading text-[26px] font-bold text-primary">
            {(evalData.mean_f1_at_10 * 100).toFixed(1)}%
          </div>
        </div>
        <div className={kpiCardClass}>
          <div className="mb-1.5 text-[13px] font-semibold text-muted-foreground">MAP (Mean Avg Precision)</div>
          <div className="font-heading text-[26px] font-bold text-accent">
            {evalData.mean_average_precision_MAP.toFixed(3)}
          </div>
        </div>
        <div className={kpiCardClass}>
          <div className="mb-1.5 text-[13px] font-semibold text-muted-foreground">MRR (Mean Reciprocal Rank)</div>
          <div className="font-heading text-[26px] font-bold text-accent">
            {evalData.mean_reciprocal_rank_MRR.toFixed(3)}
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="m-0 mb-3 font-heading text-lg font-bold text-ink-strong">
          Perbandingan Precision@10: Vector Space Model vs Boolean Retrieval
        </h2>
        <div className="mb-5 overflow-x-auto rounded-xl border border-border bg-surface p-4">
          <svg
            viewBox="0 0 700 240"
            width="100%"
            className="max-h-[260px] min-w-[540px]"
            role="img"
            aria-labelledby="eval-chart-title"
          >
            <title id="eval-chart-title">
              Grafik batang perbandingan Precision@10 antara model VSM TF-IDF dan Boolean Retrieval untuk kueri Q01 hingga Q10
            </title>

            {/* Legend */}
            <rect x="44" y="10" width="14" height="14" fill="var(--color-secondary)" rx="2" />
            <text x="64" y="21" fontSize="12" fontWeight="600" fill="var(--color-ink-strong)">
              VSM (TF-IDF Cosine)
            </text>
            <rect
              x="210"
              y="10"
              width="14"
              height="14"
              fill="var(--color-chart-slate)"
              stroke="var(--color-muted-foreground)"
              strokeWidth="1.5"
              rx="2"
            />
            <text x="230" y="21" fontSize="12" fontWeight="600" fill="var(--color-ink-strong)">
              Boolean Retrieval (OR Unranked)
            </text>

            {/* Y-Axis Gridlines */}
            <line x1="44" y1="50" x2="680" y2="50" stroke="var(--color-chart-grid)" strokeDasharray="4" />
            <text x="10" y="54" fontSize="11" fill="var(--color-muted-foreground)">0.40</text>
            <line x1="44" y1="120" x2="680" y2="120" stroke="var(--color-chart-grid)" strokeDasharray="4" />
            <text x="10" y="124" fontSize="11" fill="var(--color-muted-foreground)">0.20</text>
            <line x1="44" y1="190" x2="680" y2="190" stroke="var(--color-chart-axis)" />
            <text x="10" y="194" fontSize="11" fill="var(--color-muted-foreground)">0.00</text>

            {evalData.query_results.map((row, idx) => {
              const xBase = 58 + idx * 62;
              const maxH = 140;
              const hVsm = Math.max(2, Math.round((row.vsm_p10 / 0.4) * maxH));
              const hBool = Math.max(2, Math.round((row.boolean_p10 / 0.4) * maxH));
              return (
                <g key={row.qid}>
                  <rect
                    x={xBase}
                    y={190 - hVsm}
                    width="22"
                    height={hVsm}
                    fill="var(--color-secondary)"
                    rx="3"
                  />
                  <text
                    x={xBase + 11}
                    y={184 - hVsm}
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="middle"
                    fill="var(--color-secondary)"
                  >
                    {row.vsm_p10.toFixed(1)}
                  </text>

                  <rect
                    x={xBase + 24}
                    y={190 - hBool}
                    width="22"
                    height={hBool}
                    fill="var(--color-chart-slate)"
                    stroke="var(--color-muted-foreground)"
                    strokeWidth="1"
                    rx="3"
                  />
                  <text
                    x={xBase + 35}
                    y={184 - hBool}
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="middle"
                    fill="var(--color-muted-foreground)"
                  >
                    {row.boolean_p10.toFixed(1)}
                  </text>

                  <text
                    x={xBase + 23}
                    y="212"
                    fontSize="11.5"
                    fontWeight="700"
                    textAnchor="middle"
                    fill="var(--color-ink-strong)"
                  >
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
                <th>P@5</th>
                <th>P@10</th>
                <th>R@10</th>
                <th>AP / RR</th>
                <th>Bool P@10</th>
                <th>Relevan Ditemukan</th>
                <th>Tidak Relevan (Top-5 Noise)</th>
              </tr>
            </thead>
            <tbody>
              {evalData.query_results.map((q) => (
                <tr key={q.qid}>
                  <td><strong>{q.qid}</strong></td>
                  <td>{q.query}</td>
                  <td><code className="mono-code">{q.ground_truth_ids.join(", ")}</code></td>
                  <td>{q.vsm_p5.toFixed(2)}</td>
                  <td><strong>{q.vsm_p10.toFixed(2)}</strong></td>
                  <td>{q.vsm_r10.toFixed(2)}</td>
                  <td>{q.vsm_ap.toFixed(2)} / {q.vsm_rr.toFixed(2)}</td>
                  <td>{q.boolean_p10.toFixed(2)}</td>
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
              <strong>Mengapa Dokumen Tidak Relevan Bisa Masuk Top-5:</strong> Pada gejala umum seperti <em>&ldquo;demam&rdquo;</em>, <em>&ldquo;mual&rdquo;</em>, atau <em>&ldquo;sakit kepala&rdquo;</em>, dokumen penyakit lain dengan panjang teks lebih pendek (norma ||D|| kecil) terkadang mendapat skor kosinus kompetitif meskipun tidak memiliki gejala pembeda utama.
            </li>
            <li>
              <strong>Perbandingan Boolean Retrieval vs VSM:</strong> Model VSM berbasis pembobotan TF-IDF unggul jauh pada metrik <strong>MAP</strong> dan <strong>MRR</strong> karena menempatkan dokumen dengan irisan gejala terbanyak di posisi teratas. Sebaliknya, Boolean Retrieval dengan <code>OR</code> mengembalikan terlalu banyak dokumen secara acak (<em>unranked</em>) dan dengan <code>AND</code> ketat sering menghasilkan 0 dokumen (<em>zero recall</em>).
            </li>
            <li>
              <strong>Keterbatasan Penilaian Relevansi:</strong> Penilaian relevansi dibatasi pada 2&ndash;3 diagnosis banding klinis utama per kueri uji dari total {engine.N} dokumen, sehingga batas atas teoritis Precision@10 untuk 2 dokumen relevan adalah 0.20 (2/10). Oleh karena itu, Recall@10, MAP, dan MRR menjadi indikator kualitas pemeringkatan yang paling representatif.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
