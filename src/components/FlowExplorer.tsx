"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BarChartIcon,
  CheckCircleIcon,
  CpuIcon,
  DatabaseIcon,
  HeartPulseIcon,
  RefreshIcon,
  SearchIcon,
  SlidersIcon
} from "./Icons";

interface StepItem {
  num: string;
  title: string;
  shortDesc: string;
  detailBody: string;
  techSpec: string;
  href: string;
  ctaLabel: string;
  icon: React.ComponentType<{ size?: number }>;
  isFinal?: boolean;
}

const MEDITEMU_STEPS: StepItem[] = [
  {
    num: "1",
    title: "Buka Aplikasi",
    shortDesc: "Pengguna mengakses website MediTemu langsung tanpa login.",
    detailBody:
      "Beranda langsung terbuka tanpa meminta nama, NIK, atau akun pengguna. Penafian edukatif non-diagnosis tampil ringkas agar pengguna merasa aman.",
    techSpec: "Server Component + Floating Header + Pencarian Instan",
    href: "/",
    ctaLabel: "Buka Beranda MediTemu",
    icon: HeartPulseIcon
  },
  {
    num: "2",
    title: "Masukkan Kata Kunci",
    shortDesc: "Pengguna mengetik query gejala (mis. demam batuk) atau memilih chip cepat.",
    detailBody:
      "Mendukung keluhan bahasa awam berkat Medical Slang Normalizer ('meriang' -> 'demam', 'puyeng' -> 'pusing'), tombol hapus instan (x), dan tombol gejala cepat ramah layar sentuh (>= 44px).",
    techSpec: "Accessible Input + Clear Button + Touch Chips + Red-Flag Check",
    href: "/",
    ctaLabel: "Uji Input Kata Kunci",
    icon: SearchIcon
  },
  {
    num: "3",
    title: "Pilih Metode & Top-K",
    shortDesc: "Pilih Boolean Retrieval atau Vector Space Model (VSM) & jumlah hasil Top-5/10/15.",
    detailBody:
      "Panel Bento di sisi kanan memungkinkan peralihan mulus antara Boolean Retrieval (AND/OR/NOT) dan Vector Space Model (TF-IDF Cosine), serta Okapi BM25 di mode penguji dengan dropdown jumlah hasil Top-5/10/15.",
    techSpec: "Accessible Radio Inputs + Top-K Select Dropdown + Category Organ Filter",
    href: "/",
    ctaLabel: "Coba Pengaturan Metode",
    icon: SlidersIcon
  },
  {
    num: "4",
    title: "Sistem Memproses",
    shortDesc: "Pipeline: Preprocessing Teks -> Pencarian Dokumen -> Pengurutan (Ranking).",
    detailBody:
      "Pita pemrosesan menampilkan jumlah token bersih hasil Case Folding, Normalisasi, Stopword Removal, dan Stemming, jumlah kandidat dokumen yang cocok dari 135 korpus MedlinePlus, serta penerapan Tie-Breaking.",
    techSpec: "6-Stage NLP Pipeline + Inverted Index + 3-Tier Deterministic Tie-Breaker",
    href: "/",
    ctaLabel: "Lihat Pipeline Pemrosesan",
    icon: CpuIcon
  },
  {
    num: "5",
    title: "Lihat Hasil Pencarian",
    shortDesc: "Daftar dokumen berperingkat beserta skor kemiripan & paginasi.",
    detailBody:
      "Panel kiri menampilkan daftar bernomor dengan badge skor Cosine Similarity dan paginasi rapi (< 1 2 3 >). Pada kueri berisiko tinggi, banner triase IGD 119 tampil di atas daftar.",
    techSpec: "Semantic List + Score Pill + Paginator + Emergency Alert (role='alert')",
    href: "/",
    ctaLabel: "Lihat Daftar Peringkat",
    icon: DatabaseIcon
  },
  {
    num: "6",
    title: "Buka Detail Dokumen",
    shortDesc: "Membaca deskripsi medis, ilustrasi organ, gejala, pertolongan pertama & Buka Sumber.",
    detailBody:
      "Panel kanan menyajikan ilustrasi organ sesuai kategori penyakit, gejala yang disorot kata kuncinya, edukasi pertolongan pertama, kutipan ringkasan resmi MedlinePlus, serta tombol Buka Sumber yang mengarah langsung ke URL MedlinePlus.",
    techSpec: "Sticky Clinical Reader + Dynamic Organ SVG + Verified MedlinePlus Link",
    href: "/",
    ctaLabel: "Buka Reader Detail Dokumen",
    icon: CheckCircleIcon
  },
  {
    num: "7",
    title: "Lihat Evaluasi (Opsional)",
    shortDesc: "Meninjau performa IR: Precision@5, Recall@10, MAP, dan MRR.",
    detailBody:
      "Tersedia ringkasan kartu pastel Bento di bagian bawah beranda serta halaman Evaluasi khusus berisi grafik batang SVG VSM vs Boolean, kriteria relevansi, dan analisis dokumen relevan vs noise.",
    techSpec: "10 Clinical Test Queries + Accessible SVG Chart + Ground Truth Table",
    href: "/evaluasi",
    ctaLabel: "Buka Detail Evaluasi IR",
    icon: BarChartIcon
  },
  {
    num: "8",
    title: "Selesai!",
    shortDesc: "Informasi kesehatan relevan ditemukan — pengguna dapat klik Cari Lagi.",
    detailBody:
      "Bagian penutup alur setelah evaluasi menampilkan konfirmasi penyelesaian edukasi dan tombol 'Cari Lagi' yang mereset pencarian secara halus dan mengembalikan fokus keyboard ke kolom pencarian.",
    techSpec: "Completion Banner + Smooth Scroll & Focus Reset",
    href: "/",
    ctaLabel: "Kembali ke Pencarian",
    icon: RefreshIcon,
    isFinal: true
  }
];

export default function FlowExplorer() {
  const [selected, setSelected] = useState<StepItem>(MEDITEMU_STEPS[0]);

  return (
    <div>
      <section className="mb-[18px] rounded-3xl border border-border bg-surface px-6 py-[22px] shadow-[var(--shadow-soft-md)]">
        <h1 className="m-0 mb-1.5 font-heading text-[22px] font-extrabold text-ink-strong">
          Alur Kerja Aplikasi MediTemu (8 Langkah Terstruktur)
        </h1>
        <p className="m-0 text-[14.5px] text-muted-foreground">
          Seluruh tahapan dari pembukaan aplikasi hingga evaluasi performa IR tersinkronisasi langsung dengan antarmuka Master-Detail di beranda. Ketuk langkah mana saja untuk memeriksa detail teknisnya.
        </p>
      </section>

      <section
        className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="8 Langkah Alur Aplikasi MediTemu"
      >
        {MEDITEMU_STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = selected.num === step.num;
          return (
            <button
              key={step.num}
              type="button"
              onClick={() => setSelected(step)}
              aria-pressed={isActive}
              className={`flex min-h-[150px] flex-col justify-between gap-3 rounded-[18px] border-[1.5px] p-[18px] text-left transition duration-150 motion-reduce:transition-none motion-reduce:transform-none ${
                isActive
                  ? "border-primary bg-primary-soft shadow-[0_0_0_1px_var(--color-primary),var(--shadow-soft-md)]"
                  : "border-border bg-surface shadow-[var(--shadow-soft-sm)] hover:-translate-y-0.5 hover:border-primary hover:shadow-[var(--shadow-soft-md)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full font-heading text-sm font-extrabold text-on-primary ${
                    step.isFinal ? "bg-accent" : "bg-primary"
                  }`}
                >
                  {step.num}
                </span>
                <span className={isActive ? "text-primary" : "text-muted-foreground"}>
                  <Icon size={20} />
                </span>
              </div>

              <div>
                <h2 className="m-0 mb-1 font-heading text-[15.5px] font-bold text-ink-strong">
                  {step.title}
                </h2>
                <p className="m-0 text-[13px] leading-normal text-muted-foreground">
                  {step.shortDesc}
                </p>
              </div>
            </button>
          );
        })}
      </section>

      <section
        className="flex flex-col gap-3 rounded-3xl border border-border bg-surface px-6 py-[22px] shadow-[var(--shadow-soft-md)]"
        aria-live="polite"
      >
        <h2 className="m-0 flex items-center gap-2 font-heading text-lg font-extrabold text-foreground">
          <span
            className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full font-heading text-sm font-extrabold text-on-primary ${
              selected.isFinal ? "bg-accent" : "bg-primary"
            }`}
          >
            {selected.num}
          </span>
          Langkah {selected.num}: {selected.title}
        </h2>
        <p className="m-0 text-[15px] leading-[1.65] text-ink-strong">
          {selected.detailBody}
        </p>
        <div>
          <span className="mono-code">Arsitektur: {selected.techSpec}</span>
        </div>
        <Link
          href={selected.href}
          className="inline-flex min-h-[46px] items-center gap-2 self-start rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-primary no-underline transition-colors duration-150 hover:bg-primary-hover motion-reduce:transition-none"
        >
          <span>{selected.ctaLabel}</span>
          <ArrowRightIcon size={16} />
        </Link>
      </section>
    </div>
  );
}
