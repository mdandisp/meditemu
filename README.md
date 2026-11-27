# MediTemu: Sistem Temu Kembali Informasi Gejala Medis Berbasis Boolean Retrieval, Vector Space Model (TF-IDF & Cosine Similarity), dan Okapi BM25

Proyek Ujian Akhir Semester (UAS) **Sistem Temu Kembali Informasi (Information Retrieval)** — Program Studi S1 Informatika, Fakultas Ilmu Komputer, Universitas Pembangunan Nasional "Veteran" Jakarta.

**Tema Proyek:** *Medical Information Retrieval* (Sistem pencarian artikel dan informasi gejala kesehatan dari sumber publik terverifikasi).

---

## 1. Sumber Dataset & Karakteristik Korpus (135 Dokumen)
- Seluruh **135 dokumen medis** (`MED-001` s.d. `MED-135`) pada [`src/data/medical_dataset.json`](src/data/medical_dataset.json) diekstrak secara programatik dari korpus XML resmi **MedlinePlus Health Topics** (`https://medlineplus.gov/xml.html`, U.S. National Library of Medicine / NIH, snapshot `2026-11-26`, lisensi **Public Domain**) ke dalam **11 kategori sistem organ** dan **3 tingkat urgensi medis** (`Darurat`, `Sedang`, `Ringan`).
- Setiap dokumen memiliki `doc_id`, `disease_name`, `category`, `symptoms`, `description`, `precaution`, `urgency_level`, serta metadata verifikasi `source_id`, `source_title`, `source_excerpt`, dan `source_url` individual ke `https://medlineplus.gov/...`.
- Skrip generator korpus yang reproducible tersedia pada [`scripts/build_medlineplus_corpus.py`](scripts/build_medlineplus_corpus.py):
  ```bash
  python scripts/build_medlineplus_corpus.py --xml <path-to-mplus_topics.xml>
  ```

---

## 2. Arsitektur Algoritma & Implementasi IR (From Scratch)
Seluruh inti *Information Retrieval* diimplementasikan langsung tanpa library pencarian *black-box* pada [`src/lib/preprocessing.ts`](src/lib/preprocessing.ts) dan [`src/lib/ir-engine.ts`](src/lib/ir-engine.ts):

1. **Text Preprocessing (5+1 Tahap):**
   - *Case Folding* (huruf kecil & trim)
   - *Normalisasi Slang & Istilah Medis* (mis. `"meriang"` -> `"demam"`, `"puyeng"` -> `"pusing"`, `"buang air kecil"`/`"bak"` -> `"kencing"`, `"dbd"` -> `"demam berdarah dengue"`)
   - *Tokenization* (`\b[a-z0-9]+\b`, mempertahankan tanda kurung & operator dalam mode Boolean)
   - *Stopword Removal* (daftar kata hubung & kata umum non-diskriminatif Bahasa Indonesia)
   - *Stemming Bahasa Indonesia* (penghapusan imbuhan & aturan peluluhan + kamus pengecualian & akar kata medis terlindungi)
2. **Model 1 — Boolean Retrieval (Shunting-Yard Algorithm):**
   - Mendukung operator `AND`, `OR`, `NOT` (serta padanan Bahasa Indonesia `dan`, `atau`, `bukan`, `tidak`), pengelompokan tanda kurung `(...)`, dan penyisipan `AND` implisit antar operand yang bersebelahan.
   - Menggunakan *Inverted Index* dan operasi himpunan (irisan, gabungan, komplemen) serta menampilkan ekspresi postfix & catatan keterbatasan (*unranked binary retrieval*).
3. **Model 2 — Vector Space Model (TF-IDF & Cosine Similarity):**
   - Pembobotan: $\text{IDF}_t = \log_{10}(N / \text{df}_t) + 1.0$, bobot term $w_{t,d} = \text{tf}_{t,d} \times \text{IDF}_t$.
   - Kemiripan: $\text{Cosine}(Q, D) = \frac{\sum w_{t,q} \cdot w_{t,d}}{\|Q\| \cdot \|D\|}$.
   - **Ranking & Top-k Retrieval:** Pengurutan skor tertinggi ke terendah dengan pilihan **Top-5**, **Top-10**, dan **Top-15**.
   - **3-Tier Deterministic Tie-Breaking:** (1) Skor Cosine DESC -> (2) Jumlah term cocok (*overlap*) DESC -> (3) Tingkat urgensi medis DESC (`Darurat > Sedang > Ringan`) -> (4) `doc_id` ASC.
4. **Model Pembanding (Eksperimen Tingkat Lanjut) — Okapi BM25:**
   - Parameter $k_1 = 1.5, b = 0.75$ untuk memperhitungkan saturasi frekuensi term dan panjang dokumen relatif terhadap rata-rata korpus.
5. **X-Ray Perhitungan Manual & Inspeksi Preprocessing:**
   - Pada beranda (*Mode: Penguji UAS*), dosen/penguji dapat memeriksa tabel `TF(Q)`, `TF(D)`, `DF`, `IDF`, `W(Q)`, `W(D)`, perkalian dot product, norma vektor `||Q||` dan `||D||`, serta hasil akhir Cosine Similarity secara transparan.

---

## 3. Halaman & Fitur Antarmuka Web
- `/` ([`src/app/page.tsx`](src/app/page.tsx)): Ruang kerja pencarian 8 langkah interaktif (Input query + chip gejala cepat, pilihan metode VSM / Boolean / BM25, pilihan Top-5/10/15, filter kategori organ, pipeline telemetry, daftar hasil berperingkat + paginasi, detail dokumen + tombol **Buka Sumber**, ringkasan evaluasi, dan *Mode Penguji UAS* dengan *X-Ray Hitung Manual* & *Inspeksi Preprocessing*).
- `/alur` ([`src/app/alur/page.tsx`](src/app/alur/page.tsx)): Penjelasan arsitektur alur 8 langkah MediTemu.
- `/evaluasi` ([`src/app/evaluasi/page.tsx`](src/app/evaluasi/page.tsx)): Evaluasi 10 query uji klinis (`Precision@5`, `Precision@10`, `Recall@10`, `F1@10`, `MAP`, `MRR`), perbandingan terukur **VSM vs Okapi BM25 vs Boolean (OR & AND)**, grafik batang SVG, analisis dokumen relevan vs *noise*, dan **Eksperimen Pengaruh Preprocessing (Ablation Study)**.
- `/korpus` ([`src/app/korpus/page.tsx`](src/app/korpus/page.tsx)): Skema database, statistik karakteristik korpus ($N, |V|$, panjang dokumen), inspeksi 6 tahap preprocessing per dokumen, dan penjelajah 135 dokumen MedlinePlus.

---

## 4. Contoh Query untuk Pengujian

### A. 10 Query Uji Klinis (VSM / BM25 Benchmark)
| ID | Query Pengujian | Fokus Klinis / Ground Truth |
|----|-----------------|-----------------------------|
| Q01 | `demam tinggi sakit kepala bintik merah` | `MED-001`, `MED-004`, `MED-007` |
| Q02 | `batuk kering sesak napas demam hilang penciuman` | `MED-006`, `MED-018`, `MED-016` |
| Q03 | `nyeri dada sebelah kiri sesak napas keringat dingin` | `MED-026`, `MED-027`, `MED-028` |
| Q04 | `sakit perut kanan bawah mual muntah demam` | `MED-038`, `MED-039` |
| Q05 | `sering haus sering kencing berat badan turun` | `MED-081`, `MED-082` |
| Q06 | `gatal bentol kemerahan setelah makan makanan laut` | `MED-071`, `MED-072`, `MED-078` |
| Q07 | `nyeri sendi bengkak kemerahan jempol kaki` | `MED-061`, `MED-062` |
| Q08 | `mata kuning kulit kuning perut buncit lemas` | `MED-042`, `MED-043`, `MED-044` |
| Q09 | `pusing berputar sensasi melayang mual muntah` | `MED-051`, `MED-052` |
| Q10 | `batuk dahak lama keringat malam berat turun` | `MED-016`, `MED-018`, `MED-020` |

### B. Contoh Query Boolean Retrieval
- `(demam AND batuk) NOT pilek`
- `sesak AND (dada OR jantung)`
- `mual OR muntah`
- `tidak demam` / `demam bukan pilek`

---

## 5. Cara Instalasi, Menjalankan, dan Verifikasi (Reproducibility)

Prasyarat: **Node.js >= 20** (direkomendasikan Node.js 22+) dan `npm` atau `pnpm`.

```bash
# 1. Instalasi dependensi
npm install          # atau: pnpm install

# 2. Menjalankan server pengembangan lokal
npm run dev          # atau: pnpm run dev
# Buka http://localhost:3000 di browser

# 3. Menjalankan verifikasi unit & metrik IR otomatis
npm run verify

# 4. Build produksi & pengecekan tipe TypeScript
npm run build
```

---

## 6. Referensi & Keterbukaan Akademis
- **Dataset:** U.S. National Library of Medicine / NIH — *MedlinePlus Health Topics XML* (`https://medlineplus.gov/xml.html`), Public Domain.
- **Referensi Algoritma IR:** Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to Information Retrieval*. Cambridge University Press (Boolean Retrieval, TF-IDF, Vector Space Model, Cosine Similarity, Okapi BM25, Precision@k, MAP, MRR).
- **Keterbukaan Library & Alat Bantu:** Menggunakan Next.js 15, React 19, dan Tailwind CSS v4 untuk lapisan antarmuka web. Seluruh algoritma preprocessing Bahasa Indonesia, Inverted Index, Shunting-Yard Boolean Parser, TF-IDF Vector Space Model, Okapi BM25, dan evaluator metrik IR ditulis secara mandiri di `src/lib/` serta dapat diaudit langsung melalui fitur *X-Ray Hitung Manual* dan skrip `npm run verify`.
