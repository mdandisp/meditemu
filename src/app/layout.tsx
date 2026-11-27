import type { Metadata } from "next";
import { Atkinson_Hyperlegible, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import AppHeader from "@/components/AppHeader";
import { InfoIcon } from "@/components/Icons";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading-loaded",
  display: "swap"
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body-loaded",
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap"
});

export const metadata: Metadata = {
  title: "MediTemu",
  description:
    "MediTemu — Platform Temu Kembali Informasi Gejala Medis Edukatif menggunakan Vector Space Model (TF-IDF & Cosine Similarity), Boolean Retrieval, dan Okapi BM25 berbasis 135 topik resmi MedlinePlus (NIH/NLM)."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${atkinson.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("meditemu-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();`
          }}
        />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Langsung ke konten utama
        </a>

        <AppHeader />

        <main id="main-content" className="w-full px-3 py-4 sm:px-5 lg:px-8 lg:py-6">
          <div
            className="mb-5 flex items-center gap-2.5 rounded-xl border border-warning-strip-border bg-warning-bg/90 px-3.5 py-2.5 text-[13px] text-warning-ink"
            role="region"
            aria-label="Penafian Medis Edukatif"
          >
            <InfoIcon size={18} className="shrink-0" />
            <div>
              <strong>Informasi Edukatif (Bukan Diagnosis Dokter):</strong>{" "}
              Hasil ini disusun untuk membantu mengenali gejala berdasarkan referensi medis MedlinePlus. Tetap konsultasikan keluhan Anda kepada dokter.
            </div>
          </div>

          {children}
        </main>

        <footer className="mt-8 border-t border-border bg-surface-glass px-4 py-5 text-center text-[13px] text-muted-foreground">
          <strong>MediTemu</strong> &bull; Sistem Temu Kembali Informasi Medis &bull; Sumber Data:{" "}
          <a
            href="https://medlineplus.gov/xml.html"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            MedlinePlus.gov (NIH / NLM)
          </a>
        </footer>
      </body>
    </html>
  );
}
