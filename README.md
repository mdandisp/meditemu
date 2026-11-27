# MediTemu — Platform Temu Kembali Informasi Kesehatan (Next.js App Router + Tailwind CSS)

Implementasi antarmuka web **MediTemu** (*Medical Information Retrieval System*) menggunakan **Next.js 15 (App Router, TypeScript)** dan **Tailwind CSS v4** berdasarkan panduan **UI/UX Pro Max**.

## Sumber Dataset Resmi (135 Dokumen MedlinePlus)
- Seluruh **135 dokumen medis** pada [src/data/medical_dataset.json](src/data/medical_dataset.json) diekstrak secara programatik dari korpus XML resmi **MedlinePlus Health Topics** (`https://medlineplus.gov/xml.html`, U.S. National Library of Medicine / NIH, snapshot `2026-11-26`, berlisensi **Public Domain**).
- Setiap dokumen menyertakan `source_id`, `source_title`, `source_excerpt`, serta `source_url` individual yang dapat diklik langsung melalui tombol **Buka Sumber** di halaman pencarian maupun tabel di `/korpus`.
- Skrip generator dapat dijalankan ulang dengan `python scripts/build_medlineplus_corpus.py --xml <path-to-mplus_topics.xml>`.

## Arsitektur & Routing
- `/` (`src/app/page.tsx`): Alur 8 langkah interaktif (Buka & Kata Kunci, Pilih Metode VSM/Boolean & Top-K, Pipeline Pemrosesan, Daftar Hasil & Paginasi, Detail Dokumen + tombol **Buka Sumber**, Ringkasan Evaluasi, serta Selesai & **Cari Lagi**), dilengkapi *Mode Penguji UAS* (BM25, *X-Ray Hitung Manual*, dan *Inspeksi Preprocessing*).
- `/alur` (`src/app/alur/page.tsx`): Penjelasan arsitektur alur 8 langkah MediTemu.
- `/evaluasi` (`src/app/evaluasi/page.tsx`): Benchmark 10 query klinis (*Precision@5*, *Precision@10*, *Recall@10*, *MAP*, *MRR*) lengkap dengan grafik batang SVG aksesibel.
- `/korpus` (`src/app/korpus/page.tsx`): Skema database dan penjelajah 135 dokumen penyakit medis lengkap dengan tautan langsung ke MedlinePlus.gov.

## Cara Menjalankan di Lokal
```bash
cd medisearch-web
pnpm install
pnpm run dev
```
Lalu buka `http://localhost:3000` di browser Anda, atau dobel-klik `jalankan_nextjs.bat` di folder utama proyek.
