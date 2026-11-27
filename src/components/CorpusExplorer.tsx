"use client";

import React, { useMemo, useState } from "react";
import { inspectPreprocessingSteps } from "@/lib/preprocessing";
import type { CorpusStats, MedicalDocument, UrgencyLevel } from "@/lib/types";
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, ExternalLinkIcon } from "./Icons";

interface CorpusExplorerProps {
  documents: MedicalDocument[];
  categories: string[];
  stats: CorpusStats;
  initialDocId?: string;
}

function UrgencyPill({ level }: { level: UrgencyLevel }) {
  const baseClass =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-[3px] text-xs font-bold";

  if (level === "Darurat") {
    return (
      <span className={`${baseClass} border-emergency-badge-border bg-emergency-badge-bg text-emergency-ink`}>
        <AlertTriangleIcon size={12} />
        Darurat
      </span>
    );
  }
  if (level === "Sedang") {
    return (
      <span className={`${baseClass} border-warning-badge-border bg-warning-badge-bg text-warning-ink`}>
        <AlertCircleIcon size={12} />
        Sedang
      </span>
    );
  }
  return (
    <span className={`${baseClass} border-safe-badge-border bg-safe-badge-bg text-safe-ink`}>
      <CheckCircleIcon size={12} />
      Ringan
    </span>
  );
}

export default function CorpusExplorer({ documents, categories, stats, initialDocId }: CorpusExplorerProps) {
  const validInitial = initialDocId && documents.some((d) => d.doc_id === initialDocId) ? initialDocId : "MED-001";
  const [keyword, setKeyword] = useState(
    initialDocId && documents.some((d) => d.doc_id === initialDocId) ? initialDocId : ""
  );
  const [catFilter, setCatFilter] = useState("Semua");
  const [urgFilter, setUrgFilter] = useState("Semua");
  const [sampleDocId, setSampleDocId] = useState(validInitial);

  const sampleDoc = useMemo(
    () => documents.find((d) => d.doc_id === sampleDocId) ?? documents[0],
    [documents, sampleDocId]
  );

  const samplePrep = useMemo(() => {
    const rawContent = `${sampleDoc.disease_name} — Gejala: ${sampleDoc.symptoms} Deskripsi: ${sampleDoc.description}`;
    return inspectPreprocessingSteps(rawContent);
  }, [sampleDoc]);

  const filteredDocs = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return documents.filter((doc) => {
      if (catFilter !== "Semua" && doc.category !== catFilter) return false;
      if (urgFilter !== "Semua" && doc.urgency_level !== urgFilter) return false;
      if (q) {
        const hay = `${doc.doc_id} ${doc.disease_name} ${doc.symptoms} ${doc.category} ${doc.source_title} ${doc.source_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [documents, keyword, catFilter, urgFilter]);

  const cardClass =
    "mb-5 rounded-[18px] border border-border bg-surface p-5 shadow-[var(--shadow-soft-sm)]";
  const labelClass = "mb-1.5 block text-[12.5px] font-bold text-foreground";
  const controlClass =
    "min-h-11 w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13.5px] text-ink-strong";
  const sourcePillLinkClass =
    "inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-brand bg-primary-soft px-3 py-1.5 text-[12.5px] font-bold text-primary no-underline transition-colors duration-150 hover:border-primary hover:bg-primary hover:text-on-primary motion-reduce:transition-none";

  return (
    <div>
      {/* Database Schema Card */}
      <section className={cardClass}>
        <h1 className="m-0 mb-1.5 font-heading text-[22px] font-bold text-ink-strong">
          Struktur Database Terkurasi &amp; Eksplorasi Korpus ({documents.length} Dokumen)
        </h1>
        <p className="m-0 mb-4 text-[14.5px] text-muted-foreground">
          Rancangan skema dokumen medis terkurasi yang seluruhnya terhubung 1-ke-1 ke topik resmi{" "}
          <a
            href="https://medlineplus.gov/xml.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1 font-bold text-primary underline underline-offset-[3px] hover:text-primary-hover"
          >
            MedlinePlus Health Topics XML (NIH / U.S. National Library of Medicine)
            <ExternalLinkIcon size={14} />
          </a>{" "}
          (Public Domain).
        </p>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Atribut / Kolom</th>
                <th>Tipe Data</th>
                <th>Peran dalam Arsitektur IR &amp; Kejelasan Sumber</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code className="mono-code">doc_id</code> (PK)</td>
                <td><code className="mono-code">VARCHAR(10)</code></td>
                <td>Identitas unik dokumen (<code className="mono-code">MED-001</code> s.d. <code className="mono-code">MED-{String(documents.length).padStart(3, "0")}</code>) untuk Posting List &amp; Tie-Breaking.</td>
              </tr>
              <tr>
                <td><code className="mono-code">disease_name</code></td>
                <td><code className="mono-code">VARCHAR(120)</code></td>
                <td>Nama penyakit Bahasa Indonesia &amp; istilah klinis (bobot field 2x dalam pengindeksan).</td>
              </tr>
              <tr>
                <td><code className="mono-code">category</code></td>
                <td><code className="mono-code">VARCHAR(50)</code></td>
                <td>Klasifikasi 11 sistem organ untuk penyaringan metadata antarmuka.</td>
              </tr>
              <tr>
                <td><code className="mono-code">symptoms</code></td>
                <td><code className="mono-code">TEXT</code></td>
                <td>Deskripsi gejala klinis lengkap yang dicocokkan dengan kueri bahasa alami.</td>
              </tr>
              <tr>
                <td><code className="mono-code">urgency_level</code></td>
                <td><code className="mono-code">ENUM</code></td>
                <td>Skala triase (<code className="mono-code">Darurat | Sedang | Ringan</code>) sebagai guardrail &amp; tie-breaker.</td>
              </tr>
              <tr>
                <td><code className="mono-code">precaution</code></td>
                <td><code className="mono-code">TEXT</code></td>
                <td>Anjuran pertolongan pertama edukatif (non-diagnosis) dan kapan harus ke IGD.</td>
              </tr>
              <tr>
                <td><code className="mono-code">source_id</code> &amp; <code className="mono-code">source_title</code></td>
                <td><code className="mono-code">VARCHAR(120)</code></td>
                <td>ID topik resmi dan judul asli pada korpus XML MedlinePlus (mis. <code className="mono-code">MedlinePlus #299</code> &bull; <code className="mono-code">Flu</code>).</td>
              </tr>
              <tr>
                <td><code className="mono-code">source_url</code></td>
                <td><code className="mono-code">URL</code></td>
                <td>Tautan langsung kanonik menuju halaman sumber resmi <code className="mono-code">https://medlineplus.gov/...html</code> untuk tombol <em>Buka Sumber</em>.</td>
              </tr>
              <tr>
                <td><code className="mono-code">source_excerpt</code> &amp; <code className="mono-code">source_snapshot</code></td>
                <td><code className="mono-code">TEXT / DATE</code></td>
                <td>Kutipan ringkasan asli dari <code className="mono-code">&lt;full-summary&gt;</code> XML MedlinePlus beserta tanggal snapshot rujukan.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Karakteristik Dataset & Contoh Sebelum vs Sesudah Diproses */}
      <section className={cardClass}>
        <h2 className="m-0 mb-2 font-heading text-lg font-bold text-ink-strong">
          Sumber Resmi, Karakteristik Dataset &amp; Contoh Dokumen Sebelum vs Sesudah Diproses
        </h2>
        <p className="m-0 mb-3.5 text-sm text-muted-foreground">
          <strong>Sumber &amp; Karakteristik:</strong> {documents.length} dokumen teks unik yang diekstrak secara programatik dari rilis XML resmi{" "}
          <strong>MedlinePlus Health Topics (U.S. National Library of Medicine / NIH, snapshot {documents[0]?.source_snapshot ?? "2026-11-26"}, lisensi Public Domain)</strong> ke dalam {categories.length} kategori sistem organ. Seluruh dokumen memiliki ID topik, kutipan ringkasan asli, dan tautan URL individual yang dapat diverifikasi langsung.
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface-subtle p-3">
            <div className="text-xs font-semibold text-muted-foreground">Total Dokumen (N)</div>
            <div className="font-heading text-xl font-extrabold text-primary">{stats.total_documents}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface-subtle p-3">
            <div className="text-xs font-semibold text-muted-foreground">Ukuran Kosakata (|V|)</div>
            <div className="font-heading text-xl font-extrabold text-primary">{stats.vocabulary_size} term</div>
          </div>
          <div className="rounded-xl border border-border bg-surface-subtle p-3">
            <div className="text-xs font-semibold text-muted-foreground">Total Token Terindeks</div>
            <div className="font-heading text-xl font-extrabold text-ink-strong">{stats.total_tokens}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface-subtle p-3">
            <div className="text-xs font-semibold text-muted-foreground">Rata-rata Panjang Dokumen</div>
            <div className="font-heading text-xl font-extrabold text-ink-strong">
              {stats.avg_doc_length} <span className="text-xs font-medium text-muted-foreground">({stats.min_doc_length}&ndash;{stats.max_doc_length})</span>
            </div>
          </div>
        </div>

        <div className="mb-3.5 max-w-[460px]">
          <label htmlFor="sample-doc-select" className={labelClass}>
            Pilih Dokumen untuk Inspeksi Sebelum vs Sesudah Preprocessing:
          </label>
          <select
            id="sample-doc-select"
            className={controlClass}
            value={sampleDocId}
            onChange={(e) => setSampleDocId(e.target.value)}
          >
            {documents.map((d) => (
              <option key={d.doc_id} value={d.doc_id}>
                {d.doc_id} — {d.disease_name} ({d.source_id})
              </option>
            ))}
          </select>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kondisi / Metadata Dokumen</th>
                <th>Representasi Isi ({sampleDoc.doc_id})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="whitespace-nowrap"><strong>Sumber Resmi &amp; Tautan</strong></td>
                <td>
                  <div>
                    <strong>{sampleDoc.source}</strong> (<code className="mono-code">{sampleDoc.source_id}</code> &bull; Snapshot {sampleDoc.source_snapshot})
                  </div>
                  <div className="mt-1.5">
                    <a
                      href={sampleDoc.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={sourcePillLinkClass}
                    >
                      <span>Buka Sumber Asli: {sampleDoc.source_url}</span>
                      <ExternalLinkIcon size={14} />
                    </a>
                  </div>
                  <p className="mt-2 mb-0 text-[12.5px] italic text-muted-foreground">
                    Kutipan MedlinePlus: &ldquo;{sampleDoc.source_excerpt}&rdquo;
                  </p>
                </td>
              </tr>
              <tr>
                <td className="whitespace-nowrap"><strong>1. Sebelum Diproses (Raw)</strong></td>
                <td>{samplePrep.original}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap"><strong>2. Case Folding</strong></td>
                <td><code className="mono-code">{samplePrep.case_folding}</code></td>
              </tr>
              <tr>
                <td className="whitespace-nowrap"><strong>3. Normalisasi Slang &amp; Teks</strong></td>
                <td><code className="mono-code">{samplePrep.normalized}</code></td>
              </tr>
              <tr>
                <td className="whitespace-nowrap"><strong>4. Tokenization</strong></td>
                <td><code className="mono-code">[{samplePrep.tokenized.join(", ")}]</code></td>
              </tr>
              <tr>
                <td className="whitespace-nowrap"><strong>5. Stopword Removal</strong></td>
                <td><code className="mono-code">[{samplePrep.stopword_removed.join(", ")}]</code></td>
              </tr>
              <tr>
                <td className="whitespace-nowrap"><strong>6. Stemming (Final Tokens)</strong></td>
                <td>
                  <code className="mono-code">[{samplePrep.stemmed.join(", ")}]</code>
                  <div className="mt-1.5 text-[12.5px] text-muted-foreground">
                    Reduksi token: {samplePrep.token_count_before} token mentah &rarr; {samplePrep.token_count_after} token bersih. Pada indeks VSM/BM25, field <code className="mono-code">disease_name</code> dan <code className="mono-code">symptoms</code> diberi bobot 2x bersama <code className="mono-code">source_title</code>, <code className="mono-code">category</code>, dan <code className="mono-code">description</code>.
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Filterable Corpus Table */}
      <section className={cardClass}>
        <h2 className="m-0 mb-3.5 font-heading text-lg font-bold text-ink-strong">
          Daftar Lengkap Dokumen Medis
        </h2>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <label htmlFor="corpus-search" className={labelClass}>
              Cari Nama Penyakit / Gejala / ID:
            </label>
            <input
              id="corpus-search"
              type="text"
              className={controlClass}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Ketik kata kunci, mis. flu, diabetes, MED-015..."
            />
          </div>

          <div>
            <label htmlFor="corpus-cat" className={labelClass}>
              Saring Kategori:
            </label>
            <select
              id="corpus-cat"
              className={controlClass}
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="Semua">Semua Kategori</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="corpus-urg" className={labelClass}>
              Saring Urgensi:
            </label>
            <select
              id="corpus-urg"
              className={controlClass}
              value={urgFilter}
              onChange={(e) => setUrgFilter(e.target.value)}
            >
              <option value="Semua">Semua Tingkat Urgensi</option>
              <option value="Darurat">Darurat</option>
              <option value="Sedang">Sedang</option>
              <option value="Ringan">Ringan</option>
            </select>
          </div>
        </div>

        <p className="m-0 mb-3 text-[13.5px] text-muted-foreground">
          Menampilkan <strong>{filteredDocs.length}</strong> dari {documents.length} dokumen medis.
        </p>

        <div className="table-scroll max-h-[560px] overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Doc ID</th>
                <th>Penyakit</th>
                <th>Kategori</th>
                <th>Urgensi</th>
                <th>Gejala Klinis</th>
                <th>Sumber</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.doc_id}>
                  <td>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center rounded-md border border-transparent bg-transparent px-1.5 py-1 hover:border-border-brand hover:bg-primary-soft"
                      onClick={() => setSampleDocId(doc.doc_id)}
                      title={`Inspeksi ${doc.doc_id} di panel atas`}
                    >
                      <code className="mono-code">{doc.doc_id}</code>
                    </button>
                  </td>
                  <td>
                    <strong>{doc.disease_name}</strong>
                  </td>
                  <td>{doc.category}</td>
                  <td>
                    <UrgencyPill level={doc.urgency_level} />
                  </td>
                  <td className="min-w-[240px]">{doc.symptoms}</td>
                  <td className="min-w-[220px] text-[12.5px]">
                    <a
                      href={doc.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={sourcePillLinkClass}
                      aria-label={`Buka sumber resmi MedlinePlus untuk ${doc.disease_name} (${doc.source_id}) di tab baru`}
                    >
                      <span>{doc.source_title} ({doc.source_id})</span>
                      <ExternalLinkIcon size={13} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
