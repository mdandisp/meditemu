"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { checkEmergencyRedFlags, MedicalIREngine } from "@/lib/ir-engine";
import { inspectPreprocessingSteps, preprocessText } from "@/lib/preprocessing";
import type {
  MedicalDocument,
  RetrievalModel,
  SystemEvaluationSummary,
  UrgencyLevel
} from "@/lib/types";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  BarChartIcon,
  CalculatorIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CpuIcon,
  ExternalLinkIcon,
  FlaskIcon,
  RefreshIcon,
  SearchIcon,
  SlidersIcon,
  XIcon
} from "./Icons";
import { OrganIllustration } from "./OrganIllustrations";

interface SearchWorkspaceProps {
  initialDocuments: MedicalDocument[];
  categories: string[];
  evalSummary: SystemEvaluationSummary;
  defaultQuery?: string;
}

const QUICK_CHIPS = [
  { label: "demam batuk", query: "demam batuk", isDanger: false },
  { label: "diabetes", query: "diabetes sering haus sering kencing", isDanger: false },
  { label: "sakit kepala", query: "sakit kepala pusing berputar", isDanger: false },
  { label: "nyeri sendi", query: "nyeri sendi bengkak jempol kaki", isDanger: false },
  { label: "flu", query: "flu demam batuk pilek", isDanger: false },
  { label: "nyeri dada kiri (Uji Darurat)", query: "nyeri dada sebelah kiri sesak napas keringat dingin", isDanger: true }
];

function renderHighlightedText(text: string, queryWords: string[]) {
  const cleanWords = Array.from(
    new Set(
      queryWords
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length > 2 && !["and", "or", "not", "dan", "atau"].includes(w))
    )
  );
  if (cleanWords.length === 0) return text;

  const escaped = cleanWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(\\b(?:${escaped.join("|")})\\w*)`, "gi");
  const parts = text.split(regex);

  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <mark key={idx} className="hl">
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

function UrgencyBadge({ level }: { level: UrgencyLevel }) {
  const baseClass =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-bold";

  if (level === "Darurat") {
    return (
      <span className={`${baseClass} border-emergency-badge-border bg-emergency-badge-bg text-emergency-ink`}>
        <AlertTriangleIcon size={13} />
        Darurat
      </span>
    );
  }
  if (level === "Sedang") {
    return (
      <span className={`${baseClass} border-warning-badge-border bg-warning-badge-bg text-warning-ink`}>
        <AlertCircleIcon size={13} />
        Perlu Perhatian
      </span>
    );
  }
  return (
    <span className={`${baseClass} border-safe-badge-border bg-safe-badge-bg text-safe-ink`}>
      <CheckCircleIcon size={13} />
      Ringan
    </span>
  );
}

function StepBadge({ num, label, isDone = false }: { num: string; label: string; isDone?: boolean }) {
  const isWide = num.length > 1;
  return (
    <span
      className={`inline-flex items-center gap-2.5 self-start rounded-full py-1 pr-3.5 pl-1.5 font-heading text-xs font-bold tracking-[0.02em] ${isDone ? "bg-safe-badge-bg text-safe-ink" : "bg-primary-soft text-primary"
        }`}
    >
      <span
        className={`inline-flex h-6 shrink-0 items-center justify-center whitespace-nowrap rounded-full text-[11.5px] font-extrabold leading-none text-on-primary ${isWide ? "min-w-[38px] px-2.5" : "w-6"
          } ${isDone ? "bg-accent" : "bg-primary"}`}
      >
        {num}
      </span>
      <span>{label}</span>
    </span>
  );
}

export default function SearchWorkspace({
  initialDocuments,
  categories,
  evalSummary,
  defaultQuery = "demam batuk"
}: SearchWorkspaceProps) {
  const engine = useMemo(() => new MedicalIREngine(initialDocuments), [initialDocuments]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsPaneRef = useRef<HTMLDivElement>(null);
  const detailPaneRef = useRef<HTMLElement>(null);

  const [personaMode, setPersonaMode] = useState<"evaluator" | "public">("public");
  const [readerTab, setReaderTab] = useState<"detail" | "xray" | "prep">("detail");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const [queryInput, setQueryInput] = useState(defaultQuery);
  const [submittedQuery, setSubmittedQuery] = useState(defaultQuery);
  const [model, setModel] = useState<RetrievalModel>("vsm");
  const [topK, setTopK] = useState<number>(10);
  const [categoryFilter, setCategoryFilter] = useState<string>("Semua Kategori");

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [prepInput, setPrepInput] = useState<string>(
    "Pasien merasakan meriang panas dingin, puyeng, dan batuk-batuk berdarah!"
  );

  useEffect(() => {
    if (!submittedQuery.trim()) {
      setIsProcessing(false);
      return;
    }
    setIsProcessing(true);
    const timer = window.setTimeout(() => setIsProcessing(false), 260);
    return () => window.clearTimeout(timer);
  }, [submittedQuery, model, topK, categoryFilter]);

  const isRedFlag = useMemo(() => checkEmergencyRedFlags(submittedQuery), [submittedQuery]);

  const queryTokens = useMemo(
    () => preprocessText(submittedQuery, model === "boolean"),
    [submittedQuery, model]
  );

  const rawWords = useMemo(
    () =>
      submittedQuery
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean),
    [submittedQuery]
  );

  const vsmOrBm25Results = useMemo(() => {
    if (model === "boolean") return [];
    if (model === "bm25") return engine.searchBM25(submittedQuery, topK, categoryFilter);
    return engine.searchVSM(submittedQuery, topK, categoryFilter);
  }, [engine, model, submittedQuery, topK, categoryFilter]);

  const booleanResponse = useMemo(() => {
    if (model !== "boolean") return null;
    return engine.searchBoolean(submittedQuery, categoryFilter);
  }, [engine, model, submittedQuery, categoryFilter]);

  // Unified normalized result list for Master-Detail Step 5 & 6
  const activeResults = useMemo(() => {
    if (model === "boolean" && booleanResponse) {
      return booleanResponse.matches.slice(0, topK).map((doc, idx) => ({
        rank: idx + 1,
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
        score: null as number | null,
        overlap_terms: rawWords,
        overlap_count: 0,
        tie_breaker_used: false
      }));
    }
    return vsmOrBm25Results.map((r) => ({
      rank: r.rank,
      doc_id: r.doc_id,
      disease_name: r.disease_name,
      category: r.category,
      symptoms: r.symptoms,
      description: r.description,
      precaution: r.precaution,
      urgency_level: r.urgency_level,
      source: r.source,
      source_id: r.source_id,
      source_title: r.source_title,
      source_url: r.source_url,
      source_excerpt: r.source_excerpt,
      source_snapshot: r.source_snapshot,
      score: r.score as number | null,
      overlap_terms: r.overlap_terms,
      overlap_count: r.overlap_count,
      tie_breaker_used: r.tie_breaker_used
    }));
  }, [model, booleanResponse, vsmOrBm25Results, topK, rawWords]);

  // Pagination (4 items per page so Top-10 renders < 1 2 3 > matching Step 5)
  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(activeResults.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedResults = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return activeResults.slice(start, start + pageSize);
  }, [activeResults, safePage]);

  // Active selected document (defaults to #1 ranked result)
  const activeDetailDoc = useMemo(() => {
    if (activeResults.length === 0) return null;
    const found = activeResults.find((r) => r.doc_id === selectedDocId);
    return found ?? activeResults[0];
  }, [activeResults, selectedDocId]);

  const xrayTargetId = activeDetailDoc?.doc_id ?? "MED-001";
  const xrayData = useMemo(
    () => engine.getManualCalculationSteps(submittedQuery, xrayTargetId),
    [engine, submittedQuery, xrayTargetId]
  );

  const xrayTop3 = useMemo(() => {
    return engine
      .searchVSM(submittedQuery, 3, categoryFilter)
      .map((item) => engine.getManualCalculationSteps(submittedQuery, item.doc_id))
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [engine, submittedQuery, categoryFilter]);

  const prepSteps = useMemo(() => inspectPreprocessingSteps(prepInput), [prepInput]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedQuery(queryInput);
    setPrepInput(queryInput || prepInput);
    setCurrentPage(1);
    setSelectedDocId("");
  }

  function handleChipClick(q: string) {
    setQueryInput(q);
    setSubmittedQuery(q);
    setPrepInput(q);
    setCurrentPage(1);
    setSelectedDocId("");
    if (model === "boolean" && !/\b(AND|OR|NOT)\b/i.test(q)) {
      setModel("vsm");
    }
  }

  function handleClearInput() {
    setQueryInput("");
    searchInputRef.current?.focus();
  }

  function handleSearchAgain() {
    setQueryInput("");
    setSubmittedQuery("");
    setSelectedDocId("");
    setCurrentPage(1);
    setReaderTab("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => searchInputRef.current?.focus(), 200);
  }

  function handleSelectResult(docId: string) {
    setSelectedDocId(docId);
    if (window.innerWidth < 960) {
      detailPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function scrollToResultsList() {
    resultsPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToDetailPane() {
    detailPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const outlineBtnClass =
    "inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-border bg-surface px-4 py-2 text-[13.5px] font-bold text-ink-strong no-underline transition-colors duration-150 hover:border-primary hover:bg-primary-soft motion-reduce:transition-none";
  const selectClass =
    "min-h-12 w-full rounded-xl border border-border bg-surface-subtle px-3 py-2 text-[13.5px] font-semibold text-ink-strong";
  const infoBannerClass =
    "mb-3.5 rounded-xl border border-border-brand bg-primary-soft px-3.5 py-3 text-[13px] text-foreground";

  return (
    <div className="flex flex-col gap-5">
      {/* =======================================================
          STEPS 1, 2, 3: ASYMMETRIC EDITORIAL SEARCH + CONTROL DOCK
         ======================================================= */}
      <section
        className="grid grid-cols-1 gap-4 min-[960px]:grid-cols-[1.55fr_minmax(340px,1fr)] min-[960px]:items-stretch"
        aria-label="Pencarian Gejala dan Pengaturan Metode"
      >
        {/* Steps 1 & 2: Editorial Search Hero */}
        <form
          className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-surface p-[22px] shadow-[var(--shadow-soft-md)] md:p-7"
          onSubmit={handleSearchSubmit}
        >
          <div>
            <StepBadge num="1–2" label="Masukkan Kata Kunci" />
            <h1 className="mt-2.5 mb-1.5 font-heading text-2xl font-extrabold leading-tight tracking-[-0.025em] text-ink-strong md:text-[28px]">
              Temukan informasi kesehatan yang Anda butuhkan.
            </h1>
            <p className="m-0 text-[15px] text-muted-foreground">
              Masukkan kata kunci gejala (misalnya <em>demam batuk</em>) untuk menelusuri{" "}
              <strong>{engine.N} dokumen resmi MedlinePlus (NIH)</strong> yang dapat diverifikasi langsung ke tautan sumbernya.
            </p>
          </div>

          <div>
            <label htmlFor="meditemu-query" className="mb-2 block text-[12.5px] font-bold text-muted-foreground">
              Kata Kunci Gejala atau Kondisi Medis
            </label>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex flex-auto items-center">
                <span className="pointer-events-none absolute left-3.5 flex text-muted-foreground">
                  <SearchIcon size={18} />
                </span>
                <input
                  ref={searchInputRef}
                  id="meditemu-query"
                  type="text"
                  className="min-h-[52px] w-full rounded-[18px] border-[1.5px] border-border bg-surface-subtle py-3 pr-[52px] pl-[42px] text-[15.5px] text-ink-strong transition duration-150 focus:border-primary focus:bg-surface focus:shadow-[0_0_0_4px_rgba(11,92,171,0.12)] focus:outline-none motion-reduce:transition-none"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Cari informasi kesehatan (contoh: demam batuk)..."
                />
                {queryInput.length > 0 && (
                  <button
                    type="button"
                    className="absolute right-1 inline-flex size-11 items-center justify-center rounded-full border-0 bg-transparent text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-ink-strong motion-reduce:transition-none"
                    onClick={handleClearInput}
                    aria-label="Hapus kata kunci pencarian"
                  >
                    <XIcon size={16} />
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-[18px] border-0 bg-primary px-6 py-3 font-heading text-[15px] font-bold text-on-primary shadow-[0_6px_16px_rgba(11,92,171,0.24)] transition duration-150 hover:-translate-y-px hover:bg-primary-hover motion-reduce:transition-none motion-reduce:transform-none"
              >
                <SearchIcon size={18} />
                Cari Informasi
              </button>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[12.5px] font-bold text-muted-foreground">Contoh pencarian cepat:</div>
            <div className="flex flex-wrap gap-2">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleChipClick(chip.query)}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors duration-150 motion-reduce:transition-none ${chip.isDanger
                    ? "border-emergency-badge-border bg-emergency-bg text-emergency-ink hover:bg-emergency-badge-bg"
                    : "border-border bg-surface-subtle text-foreground hover:border-primary hover:bg-primary-soft"
                    }`}
                >
                  {chip.label}
                </button>
              ))}
              {personaMode === "evaluator" && (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-3.5 py-1.5 text-[13px] font-bold text-foreground transition-colors duration-150 hover:border-primary hover:bg-primary-soft motion-reduce:transition-none"
                  onClick={() => {
                    setModel("boolean");
                    setQueryInput("(demam AND batuk) NOT pilek");
                    setSubmittedQuery("(demam AND batuk) NOT pilek");
                    setCurrentPage(1);
                    setSelectedDocId("");
                  }}
                >
                  (demam AND batuk) NOT pilek
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Step 3: Bento Control Dock */}
        <aside
          className="flex flex-col gap-3.5 rounded-3xl border border-border bg-surface p-[22px] shadow-[var(--shadow-soft-md)]"
          aria-label="Pilih Metode dan Top-K"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StepBadge num="3" label="Pilih Metode & Top-K" />
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-3.5 py-1.5 text-[12.5px] font-bold text-foreground transition-colors duration-150 hover:border-primary hover:bg-primary-soft motion-reduce:transition-none"
              aria-pressed={personaMode === "evaluator"}
              onClick={() => {
                const next = personaMode === "evaluator" ? "public" : "evaluator";
                setPersonaMode(next);
                if (next === "public") {
                  setReaderTab("detail");
                  if (model === "bm25") {
                    setModel("vsm");
                  }
                }
              }}
            >
              <SlidersIcon size={14} />
              {personaMode === "evaluator" ? "Mode: Penguji UAS" : "Mode: Masyarakat Awam"}
            </button>
          </div>

          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-2.5 font-heading text-base font-bold text-ink-strong">
              Metode Pencarian:
            </legend>
            <div className="flex flex-col gap-2">
              <label
                className={`relative flex min-h-12 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border-[1.5px] px-3.5 py-2.5 text-left transition-colors duration-150 has-[:focus-visible]:outline-[2.5px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring motion-reduce:transition-none ${model === "boolean"
                  ? "border-primary bg-primary-soft shadow-[0_0_0_1px_var(--color-primary)]"
                  : "border-border bg-surface-subtle hover:border-primary hover:bg-primary-soft"
                  }`}
              >
                <input
                  type="radio"
                  name="ir-retrieval-method"
                  value="boolean"
                  checked={model === "boolean"}
                  onChange={() => {
                    setModel("boolean");
                    setCurrentPage(1);
                  }}
                  className="sr-only"
                />
                <span>
                  <strong className="block text-[13.5px]">Boolean Retrieval</strong>
                  <span className="text-xs text-muted-foreground">Operator eksak AND, OR, NOT</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${model === "boolean" ? "border-primary" : "border-border"
                    }`}
                >
                  {model === "boolean" && <span className="size-[9px] rounded-full bg-primary" />}
                </span>
              </label>

              <label
                className={`relative flex min-h-12 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border-[1.5px] px-3.5 py-2.5 text-left transition-colors duration-150 has-[:focus-visible]:outline-[2.5px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring motion-reduce:transition-none ${model === "vsm"
                  ? "border-primary bg-primary-soft shadow-[0_0_0_1px_var(--color-primary)]"
                  : "border-border bg-surface-subtle hover:border-primary hover:bg-primary-soft"
                  }`}
              >
                <input
                  type="radio"
                  name="ir-retrieval-method"
                  value="vsm"
                  checked={model === "vsm"}
                  onChange={() => {
                    setModel("vsm");
                    setCurrentPage(1);
                  }}
                  className="sr-only"
                />
                <span>
                  <strong className="block text-[13.5px]">Vector Space Model (VSM)</strong>
                  <span className="text-xs text-muted-foreground">Pembobotan TF-IDF &amp; Cosine Similarity</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${model === "vsm" ? "border-primary" : "border-border"
                    }`}
                >
                  {model === "vsm" && <span className="size-[9px] rounded-full bg-primary" />}
                </span>
              </label>

              {personaMode === "evaluator" && (
                <label
                  className={`relative flex min-h-12 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border-[1.5px] px-3.5 py-2.5 text-left transition-colors duration-150 has-[:focus-visible]:outline-[2.5px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring motion-reduce:transition-none ${model === "bm25"
                    ? "border-primary bg-primary-soft shadow-[0_0_0_1px_var(--color-primary)]"
                    : "border-border bg-surface-subtle hover:border-primary hover:bg-primary-soft"
                    }`}
                >
                  <input
                    type="radio"
                    name="ir-retrieval-method"
                    value="bm25"
                    checked={model === "bm25"}
                    onChange={() => {
                      setModel("bm25");
                      setCurrentPage(1);
                    }}
                    className="sr-only"
                  />
                  <span>
                    <strong className="block text-[13.5px]">Okapi BM25</strong>
                    <span className="text-xs text-muted-foreground">Model probabilistik pembanding (k1=1.5)</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${model === "bm25" ? "border-primary" : "border-border"
                      }`}
                  >
                    {model === "bm25" && <span className="size-[9px] rounded-full bg-primary" />}
                  </span>
                </label>
              )}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="topk-dock-select" className="mb-1.5 block text-[12.5px] font-bold text-muted-foreground">
                Jumlah Hasil:
              </label>
              <select
                id="topk-dock-select"
                className={selectClass}
                value={topK}
                onChange={(e) => {
                  setTopK(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={5}>Top-5</option>
                <option value={10}>Top-10</option>
                <option value={15}>Top-15</option>
              </select>
            </div>

            <div>
              <label htmlFor="cat-dock-select" className="mb-1.5 block text-[12.5px] font-bold text-muted-foreground">
                Kategori Organ:
              </label>
              <select
                id="cat-dock-select"
                className={selectClass}
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="Semua Kategori">Semua Kategori</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </aside>
      </section>

      {/* =======================================================
          STEP 4: SISTEM MEMPROSES (LIVE PIPELINE TELEMETRY)
         ======================================================= */}
      {submittedQuery.trim().length > 0 && (
        <section
          className="flex flex-col gap-2.5 rounded-[18px] border border-border bg-surface px-[18px] py-3.5 shadow-[var(--shadow-soft-sm)]"
          aria-label="Langkah 4 Sistem Memproses Query"
          aria-busy={isProcessing}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StepBadge num="4" label="Sistem Memproses" />
            <span aria-live="polite" className="text-[12.5px] text-muted-foreground">
              {isProcessing ? (
                "Memproses..."
              ) : (
                <>
                  Selesai memproses kueri: <code className="mono-code">{submittedQuery}</code>
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            <div className="flex items-center gap-2.5 rounded-xl border border-muted bg-surface-subtle px-3 py-2.5">
              <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                <FlaskIcon size={17} />
              </span>
              <div>
                <strong className="block text-[13px]">Preprocessing Teks</strong>
                <span className="text-xs text-muted-foreground">
                  {queryTokens.length} token bersih: [{queryTokens.slice(0, 4).join(", ")}]
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-muted bg-surface-subtle px-3 py-2.5">
              <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                <CpuIcon size={17} />
              </span>
              <div>
                <strong className="block text-[13px]">
                  Pencarian Dokumen ({model === "boolean" ? "Boolean" : model === "bm25" ? "BM25" : "VSM"})
                </strong>
                <span className="text-xs text-muted-foreground">
                  {model === "boolean" && booleanResponse
                    ? `${booleanResponse.count} dokumen cocok eksak`
                    : `${activeResults.length} kandidat relevan dari ${engine.N} dokumen`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-muted bg-surface-subtle px-3 py-2.5">
              <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                <CheckCircleIcon size={17} />
              </span>
              <div>
                <strong className="block text-[13px]">Pengurutan Hasil (Ranking)</strong>
                <span className="text-xs text-muted-foreground">
                  Menampilkan Top-{topK} hasil terbaik
                </span>
              </div>
            </div>
          </div>

          <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={`h-full w-full origin-left rounded-full bg-gradient-to-r from-primary to-teal transition-transform duration-200 motion-reduce:transition-none ${isProcessing ? "scale-x-[0.55]" : "scale-x-100"
                }`}
            />
          </div>
        </section>
      )}

      {/* EMERGENCY TRIAGE ALERT */}
      {isRedFlag && (
        <div
          className="flex items-start gap-3.5 rounded-[18px] border-2 border-emergency-border bg-emergency-bg px-5 py-4 text-emergency-ink"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangleIcon size={24} className="shrink-0" />
          <div>
            <h2 className="m-0 mb-1 font-heading text-base font-bold">
              Peringatan Gawat Darurat Medis (Red Flag Terdeteksi)
            </h2>
            <p className="m-0 text-sm">
              Keluhan yang Anda ketik mengarah pada gejala berisiko tinggi. Segera hubungi{" "}
              <strong>Layanan Darurat Medis 119</strong> atau menuju{" "}
              <strong>IGD Rumah Sakit terdekat</strong>.
            </p>
          </div>
        </div>
      )}

      {/* =======================================================
          STEPS 5 & 6: MASTER-DETAIL SPLIT WORKSPACE (FULL-WIDTH DESKTOP & INTERACTIVE MOBILE)
         ======================================================= */}
      {submittedQuery.trim().length > 0 && (
        <>
          <div className="flex items-center gap-2 min-[960px]:hidden">
            <button
              type="button"
              onClick={scrollToResultsList}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs font-bold text-ink-strong shadow-[var(--shadow-soft-sm)] hover:border-primary hover:text-primary"
            >
              Daftar Hasil ({activeResults.length})
            </button>
            <button
              type="button"
              onClick={scrollToDetailPane}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-primary bg-primary-soft px-3 py-2 text-xs font-bold text-primary shadow-[var(--shadow-soft-sm)]"
            >
              Detail Dokumen {activeDetailDoc ? `(${activeDetailDoc.doc_id})` : ""}
            </button>
          </div>

          <section
            className="grid grid-cols-1 items-start gap-[18px] min-[960px]:grid-cols-[minmax(360px,0.88fr)_1.4fr] xl:grid-cols-[minmax(420px,0.85fr)_1.45fr]"
            aria-label="Hasil Pencarian dan Detail Dokumen"
          >
            {/* LEFT PANE — STEP 5: LIHAT HASIL PENCARIAN */}
            <div
              ref={resultsPaneRef}
              className="rounded-3xl border border-border bg-surface p-[18px] shadow-[var(--shadow-soft-md)]"
            >
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                <StepBadge num="5" label={`Lihat Hasil Pencarian (${activeResults.length})`} />
                <span className="text-[12.5px] text-muted-foreground">
                  Hal {safePage} dari {totalPages}
                </span>
              </div>

              {model === "boolean" && booleanResponse && (
                <div className={infoBannerClass}>
                  <strong>Ekspresi Postfix:</strong>{" "}
                  <code className="mono-code">{booleanResponse.postfix_expression.join(" ") || "-"}</code>
                  <div className="mt-1">{booleanResponse.limitation_note}</div>
                </div>
              )}

              {pagedResults.length === 0 ? (
                <div className="rounded-xl border border-muted bg-surface-subtle px-4 py-3.5">
                  <strong>Belum ada dokumen yang cocok dengan kata kunci tersebut.</strong>
                  <p className="mt-1.5 mb-3 text-[13.5px] text-muted-foreground">
                    {model === "boolean"
                      ? "Operator AND ketat sering menyebabkan Zero Recall. Coba beralih ke Vector Space Model (VSM) agar kemiripan parsial tetap ditemukan."
                      : "Ketuk salah satu contoh pencarian cepat di atas atau masukkan gejala fisik umum."}
                  </p>
                  {model === "boolean" && (
                    <button
                      type="button"
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-5 py-2.5 font-heading text-sm font-bold text-on-primary transition-colors duration-150 hover:bg-primary-hover motion-reduce:transition-none"
                      onClick={() => setModel("vsm")}
                    >
                      Beralih ke VSM (TF-IDF)
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {pagedResults.map((doc) => {
                      const isSelected = activeDetailDoc?.doc_id === doc.doc_id;
                      return (
                        <li key={doc.doc_id} className="m-0">
                          <button
                            type="button"
                            onClick={() => handleSelectResult(doc.doc_id)}
                            aria-pressed={isSelected}
                            className={`flex min-h-16 w-full items-start justify-between gap-3 rounded-xl border-[1.5px] p-3.5 text-left transition duration-150 motion-reduce:transition-none ${isSelected
                              ? "border-primary border-l-[5px] bg-surface shadow-[var(--shadow-soft-md)]"
                              : "border-border bg-surface-subtle hover:border-primary hover:bg-surface"
                              }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full font-heading text-[13px] font-extrabold ${isSelected ? "bg-primary text-on-primary" : "bg-primary-soft text-primary"
                                  }`}
                              >
                                {doc.rank}
                              </span>
                              <div>
                                <strong className="block text-[15px] text-ink-strong">
                                  {doc.disease_name}
                                </strong>
                                <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                                  {doc.symptoms.slice(0, 78)}&hellip;
                                </span>
                              </div>
                            </div>

                            <span className="shrink-0 rounded-full bg-tint-blue-bg px-2.5 py-1 font-mono text-[13px] font-bold text-tint-blue-ink">
                              {doc.score !== null ? doc.score.toFixed(2) : "Cocok"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Pagination (< 1 2 3 >) */}
                  {totalPages > 1 && (
                    <nav
                      className="mt-3.5 flex items-center justify-center gap-2 border-t border-muted pt-3.5"
                      aria-label="Paginasi Hasil Pencarian"
                    >
                      <button
                        type="button"
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface px-3 py-1.5 text-[13.5px] font-bold text-ink-strong disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        aria-label="Halaman sebelumnya"
                      >
                        <ChevronLeftIcon size={16} />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 py-1.5 text-[13.5px] font-bold ${safePage === pageNum
                            ? "border-primary bg-primary text-on-primary"
                            : "border-border bg-surface text-ink-strong hover:border-primary hover:bg-primary-soft"
                            }`}
                          onClick={() => setCurrentPage(pageNum)}
                          aria-current={safePage === pageNum ? "page" : undefined}
                        >
                          {pageNum}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface px-3 py-1.5 text-[13.5px] font-bold text-ink-strong disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        aria-label="Halaman berikutnya"
                      >
                        <ChevronRightIcon size={16} />
                      </button>
                    </nav>
                  )}
                </>
              )}
            </div>

            {/* RIGHT PANE — STEP 6: BUKA DETAIL DOKUMEN (+ X-RAY & PREPROCESSING UNTUK DOSEN) */}
            <article
              ref={detailPaneRef}
              className="rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-soft-md)] min-[960px]:sticky min-[960px]:top-24 min-[960px]:p-6"
              aria-live="polite"
            >
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StepBadge num="6" label="Buka Detail Dokumen" />
                  <button
                    type="button"
                    onClick={scrollToResultsList}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs font-bold text-ink-strong hover:border-primary hover:text-primary min-[960px]:hidden"
                  >
                    <ChevronLeftIcon size={13} />
                    Daftar Hasil
                  </button>
                </div>
                {activeDetailDoc && <span className="mono-code">{activeDetailDoc.doc_id}</span>}
              </div>

              {personaMode === "evaluator" && (
                <div
                  className="mb-[18px] flex flex-wrap gap-2 border-b border-muted pb-3.5"
                  role="tablist"
                  aria-label="Mode Pembaca Detail Dokumen"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={readerTab === "detail"}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold ${readerTab === "detail"
                      ? "border-foreground bg-foreground text-on-primary"
                      : "border-border bg-surface-subtle text-foreground hover:border-primary hover:bg-primary-soft"
                      }`}
                    onClick={() => setReaderTab("detail")}
                  >
                    Detail Edukatif
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={readerTab === "xray"}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold ${readerTab === "xray"
                      ? "border-foreground bg-foreground text-on-primary"
                      : "border-border bg-surface-subtle text-foreground hover:border-primary hover:bg-primary-soft"
                      }`}
                    onClick={() => setReaderTab("xray")}
                  >
                    <CalculatorIcon size={15} />
                    X-Ray Hitung Manual
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={readerTab === "prep"}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold ${readerTab === "prep"
                      ? "border-foreground bg-foreground text-on-primary"
                      : "border-border bg-surface-subtle text-foreground hover:border-primary hover:bg-primary-soft"
                      }`}
                    onClick={() => setReaderTab("prep")}
                  >
                    <FlaskIcon size={15} />
                    Inspeksi Preprocessing
                  </button>
                </div>
              )}

              {/* READER VIEW A: DETAIL DOKUMEN */}
              {readerTab === "detail" && (
                activeDetailDoc ? (
                  <>
                    <div className="mb-[18px] flex flex-col gap-3.5 min-[560px]:flex-row min-[560px]:items-center">
                      <OrganIllustration category={activeDetailDoc.category} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary-soft px-3 py-1 text-[12.5px] font-bold text-primary">
                            {activeDetailDoc.category}
                          </span>
                          <UrgencyBadge level={activeDetailDoc.urgency_level} />
                          {activeDetailDoc.tie_breaker_used && (
                            <span className="mono-code">Tie-Breaker</span>
                          )}
                        </div>
                        <h2 className="mt-1.5 mb-2 font-heading text-[21px] font-extrabold text-ink-strong">
                          {activeDetailDoc.disease_name}
                        </h2>
                        {activeDetailDoc.score !== null && (
                          <div className="text-[13px] font-bold text-primary">
                            Skor Kemiripan ({model === "bm25" ? "BM25" : "Cosine VSM"}):{" "}
                            {activeDetailDoc.score.toFixed(2)} ({activeDetailDoc.score}) &bull; {activeDetailDoc.overlap_count} term cocok
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mb-4 rounded-xl border border-muted bg-surface-subtle px-4 py-3.5">
                      <h3 className="m-0 mb-1.5 font-heading text-sm font-bold text-foreground">
                        Deskripsi Kondisi Medis
                      </h3>
                      <p className="m-0 text-[14.5px] leading-relaxed">
                        {activeDetailDoc.description}
                      </p>
                    </div>

                    <div className="mb-4 rounded-xl border border-muted bg-surface-subtle px-4 py-3.5">
                      <h3 className="m-0 mb-1.5 font-heading text-sm font-bold text-foreground">
                        Gejala Umum &amp; Kata Kunci Cocok
                      </h3>
                      <p className="m-0 text-[14.5px] leading-[1.65]">
                        {renderHighlightedText(activeDetailDoc.symptoms, [
                          ...rawWords,
                          ...activeDetailDoc.overlap_terms
                        ])}
                      </p>
                    </div>

                    <div className="mb-4 rounded-xl border border-safe-badge-border bg-teal-soft px-4 py-3.5">
                      <h3 className="m-0 mb-1.5 font-heading text-sm font-bold text-foreground">
                        Edukasi Pertolongan Pertama &amp; Penanganan Awal
                      </h3>
                      <p className="m-0 text-[14.5px] leading-relaxed">
                        {activeDetailDoc.precaution}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-[13px]">
                      <div className="flex flex-col gap-1.5">
                        <div>
                          <strong>Sumber:</strong>{" "}
                          <a
                            href={activeDetailDoc.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-primary underline underline-offset-[3px] hover:text-primary-hover"
                            aria-label={`Sumber resmi MedlinePlus ${activeDetailDoc.source_title} (buka di tab baru)`}
                          >
                            MedlinePlus &mdash; {activeDetailDoc.source_title}
                          </a>{" "}
                          <span className="mono-code">{activeDetailDoc.source_id}</span>
                        </div>
                        <p className="m-0 text-[12.5px] italic leading-normal text-muted-foreground">
                          &ldquo;{activeDetailDoc.source_excerpt}&rdquo;
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2.5">
                        <Link href={`/korpus?doc=${activeDetailDoc.doc_id}`} className={outlineBtnClass}>
                          <span>Lihat di Korpus</span>
                        </Link>
                        <a
                          href={activeDetailDoc.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-primary bg-primary px-[18px] py-2 text-[13.5px] font-bold text-on-primary no-underline transition duration-150 hover:-translate-y-px hover:border-primary-hover hover:bg-primary-hover motion-reduce:transition-none motion-reduce:transform-none"
                          aria-label={`Buka halaman sumber resmi MedlinePlus untuk ${activeDetailDoc.disease_name} di tab baru`}
                        >
                          <span>Buka Sumber</span>
                          <ExternalLinkIcon size={14} />
                        </a>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-muted bg-surface-subtle px-4 py-3.5">
                    <p className="m-0">
                      Tidak ada dokumen yang terpilih. Coba ubah kata kunci pencarian atau pilih metode VSM.
                    </p>
                  </div>
                )
              )}

              {/* READER VIEW B: X-RAY PERHITUNGAN MANUAL */}
              {readerTab === "xray" && personaMode === "evaluator" && xrayData && (
                <div>
                  <p className="m-0 mb-3 text-[13.5px] text-muted-foreground">
                    Validasi matematis untuk kueri <code className="mono-code">{xrayData.query_original}</code> terhadap dokumen terpilih <code className="mono-code">{xrayData.doc_id}</code> (N = {xrayData.total_documents_N}).
                  </p>

                  {xrayTop3.length > 0 && (
                    <div className="mb-4">
                      <h3 className="m-0 mb-1.5 font-heading text-sm font-bold text-foreground">
                        Perbandingan Top-3 Dokumen (1 Query)
                      </h3>
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Doc ID</th>
                              <th>Penyakit</th>
                              <th>Dot Product</th>
                              <th>||Q|| &times; ||D||</th>
                              <th>Cosine</th>
                            </tr>
                          </thead>
                          <tbody>
                            {xrayTop3.map((item) => (
                              <tr key={item.doc_id}>
                                <td><code className="mono-code">{item.doc_id}</code></td>
                                <td>{item.disease_name}</td>
                                <td>{item.dot_product_sum}</td>
                                <td>{item.denominator}</td>
                                <td><strong>{item.final_cosine_similarity}</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className={infoBannerClass}>
                    <strong>Representasi Vektor:</strong>
                    <div className="mt-1 overflow-x-auto font-mono text-xs">
                      <div>Q = [{xrayData.terms_detail.map((t) => `${t.term}:${t.w_query}`).join(", ")}]</div>
                      <div>{xrayData.doc_id} = [{xrayData.terms_detail.map((t) => `${t.term}:${t.w_doc}`).join(", ")}]</div>
                    </div>
                  </div>

                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Term</th>
                          <th>TF(Q)</th>
                          <th>TF(D)</th>
                          <th>DF</th>
                          <th>IDF</th>
                          <th>W(Q)</th>
                          <th>W(D)</th>
                          <th>Wq&middot;Wd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {xrayData.terms_detail.map((row) => (
                          <tr key={row.term}>
                            <td><code className="mono-code">{row.term}</code></td>
                            <td>{row.tf_query}</td>
                            <td>{row.tf_doc}</td>
                            <td>{row.df}</td>
                            <td>{row.idf}</td>
                            <td>{row.w_query}</td>
                            <td>{row.w_doc}</td>
                            <td><strong>{row.product_wq_wd}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3.5 overflow-x-auto rounded-xl border border-border bg-ink-strong p-4 font-mono text-[13px] leading-[1.7] text-chart-grid dark:bg-slate-950 dark:text-sky-100">
                    Sim(Q, {xrayData.doc_id}) = {xrayData.dot_product_sum} / ({xrayData.query_norm} * {xrayData.doc_norm}) ={" "}
                    <strong>{xrayData.final_cosine_similarity} ({xrayData.final_percentage}%)</strong>
                  </div>
                </div>
              )}

              {/* READER VIEW C: INSPEKSI PREPROCESSING */}
              {readerTab === "prep" && personaMode === "evaluator" && (
                <div>
                  <label htmlFor="reader-prep-input" className="mb-2 block font-heading text-sm font-bold text-foreground">
                    Uji Kalimat Preprocessing Bahasa Indonesia:
                  </label>
                  <input
                    id="reader-prep-input"
                    type="text"
                    className="mb-3.5 min-h-[52px] w-full rounded-[18px] border-[1.5px] border-border bg-surface-subtle px-3.5 py-3 text-[15.5px] text-ink-strong focus:border-primary focus:bg-surface focus:outline-none"
                    value={prepInput}
                    onChange={(e) => setPrepInput(e.target.value)}
                  />

                  <div className="table-scroll mb-3.5">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tahap</th>
                          <th>Output</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td><strong>1. Original</strong></td><td>{prepSteps.original}</td></tr>
                        <tr><td><strong>2. Case Folding</strong></td><td><code className="mono-code">{prepSteps.case_folding}</code></td></tr>
                        <tr><td><strong>3. Normalisasi Slang</strong></td><td><code className="mono-code">{prepSteps.normalized}</code></td></tr>
                        <tr><td><strong>4. Tokenization</strong></td><td><code className="mono-code">[{prepSteps.tokenized.join(", ")}]</code></td></tr>
                        <tr><td><strong>5. Stopwords</strong></td><td><code className="mono-code">[{prepSteps.stopword_removed.join(", ")}]</code></td></tr>
                        <tr><td><strong>6. Stemming</strong></td><td><code className="mono-code">[{prepSteps.stemmed.join(", ")}]</code></td></tr>
                      </tbody>
                    </table>
                  </div>

                  <div className={infoBannerClass}>
                    <strong>Pengaruh terhadap Retrieval:</strong> Case folding &amp; slang normalizer menaikkan <em>recall</em> untuk istilah awam (&ldquo;meriang&rdquo; &rarr; &ldquo;demam&rdquo;); stopword removal menekan noise pembilang; stemming menyatukan imbuhan (&ldquo;berdarah&rdquo; &rarr; &ldquo;darah&rdquo;).
                  </div>
                </div>
              )}
            </article>
          </section>
        </>
      )}

      {/* =======================================================
          STEP 7: LIHAT EVALUASI (OPSIONAL)
         ======================================================= */}
      <section
        className="rounded-3xl border border-border bg-surface px-[22px] py-5 shadow-[var(--shadow-soft-md)]"
        aria-label="Langkah 7 Ringkasan Evaluasi Sistem"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1.5">
              <StepBadge num="7" label="Lihat Evaluasi (Opsional)" />
            </div>
            <p className="mt-1 mb-0 text-[13.5px] text-muted-foreground">
              Hasil benchmark otomatis pada {evalSummary.total_queries_tested} query klinis terhadap {engine.N} dokumen resmi MedlinePlus.
            </p>
          </div>
          <Link href="/evaluasi" className={outlineBtnClass}>
            <BarChartIcon size={17} />
            Lihat Detail Evaluasi
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="flex flex-col gap-1 rounded-[18px] bg-tint-blue-bg p-4 text-tint-blue-ink">
            <span className="text-[13px] font-bold">Precision@5</span>
            <span className="font-heading text-[26px] font-extrabold">{evalSummary.mean_precision_at_5.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-[18px] bg-tint-green-bg p-4 text-tint-green-ink">
            <span className="text-[13px] font-bold">Recall@10</span>
            <span className="font-heading text-[26px] font-extrabold">{evalSummary.mean_recall_at_10.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-[18px] bg-tint-violet-bg p-4 text-tint-violet-ink">
            <span className="text-[13px] font-bold">MAP</span>
            <span className="font-heading text-[26px] font-extrabold">{evalSummary.mean_average_precision_MAP.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-[18px] bg-tint-amber-bg p-4 text-tint-amber-ink">
            <span className="text-[13px] font-bold">MRR</span>
            <span className="font-heading text-[26px] font-extrabold">{evalSummary.mean_reciprocal_rank_MRR.toFixed(2)}</span>
          </div>
        </div>
      </section>

      {/* =======================================================
          STEP 8: SELESAI! CARI LAGI
         ======================================================= */}
      {submittedQuery.trim().length > 0 && activeDetailDoc && (
        <section
          className="flex flex-wrap items-center justify-between gap-3.5 rounded-3xl border-[1.5px] border-safe-badge-border bg-accent-soft px-[22px] py-[18px] shadow-[var(--shadow-soft-sm)]"
          aria-label="Langkah 8 Selesai Pencarian"
        >
          <div className="flex items-center gap-3.5 text-safe-ink">
            <span
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent"
              aria-hidden="true"
            >
              <CheckCircleIcon size={24} />
            </span>
            <div>
              <div className="mb-1">
                <StepBadge num="8" label="Selesai!" isDone />
              </div>
              <div className="text-[15px] font-bold text-ink-strong">
                Informasi yang Anda cari sudah ditemukan!
              </div>
              <div className="text-[13px] text-safe-ink">
                Anda sedang membaca <strong>{activeDetailDoc.disease_name}</strong> dari sumber terverifikasi MedlinePlus.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-0 bg-foreground px-4 py-2 text-[13.5px] font-bold text-on-primary transition-colors duration-150 hover:bg-primary motion-reduce:transition-none"
            onClick={handleSearchAgain}
          >
            <RefreshIcon size={16} />
            Cari Lagi
          </button>
        </section>
      )}
    </div>
  );
}
