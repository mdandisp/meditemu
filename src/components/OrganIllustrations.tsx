import React from "react";

export function MediTemuLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Botanical Leaf Wing */}
      <path
        d="M8 28C8 36 15 41 24 41C19 36 15 31 12 24C9.5 24 8 25.5 8 28Z"
        fill="#0D9488"
        opacity="0.9"
      />
      <path
        d="M40 28C40 36 33 41 24 41C29 36 33 31 36 24C38.5 24 40 25.5 40 28Z"
        fill="#0284C7"
        opacity="0.9"
      />
      {/* Heart / Shield Core */}
      <path
        d="M24 38C24 38 11 29.5 11 19.5C11 14.8 14.7 11 19.2 11C21.6 11 23.4 12.1 24 13.4C24.6 12.1 26.4 11 28.8 11C33.3 11 37 14.8 37 19.5C37 29.5 24 38 24 38Z"
        fill="url(#meditemuGrad)"
      />
      {/* Crisp Medical Cross */}
      <path
        d="M22.2 18H25.8V21.7H29.5V25.3H25.8V29H22.2V25.3H18.5V21.7H22.2V18Z"
        fill="#FFFFFF"
      />
      <defs>
        <linearGradient id="meditemuGrad" x1="11" y1="11" x2="37" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0284C7" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function OrganIllustration({ category }: { category: string }) {
  const cat = category.toLowerCase();

  // Sistem Pernapasan — Ilustrasi Paru-Paru Klinis (sesuai Langkah 6 diagram MediTemu)
  if (cat.includes("pernapasan") || cat.includes("tht")) {
    return (
      <svg viewBox="0 0 120 100" width="110" height="92" fill="none" aria-hidden="true">
        <rect width="120" height="100" rx="14" fill="#EFF6FF" />
        <path d="M60 16V40" stroke="#0E7490" strokeWidth="4" strokeLinecap="round" />
        <path d="M60 36L46 46M60 36L74 46" stroke="#0E7490" strokeWidth="3.5" strokeLinecap="round" />
        {/* Left Lung */}
        <path
          d="M52 38C42 36 26 48 24 68C23 76 30 82 39 81C47 80 53 74 53 64V42C53 40 52.5 38.5 52 38Z"
          fill="#FDA4AF"
          stroke="#E11D48"
          strokeWidth="2"
        />
        {/* Right Lung */}
        <path
          d="M68 38C78 36 94 48 96 68C97 76 90 82 81 81C73 80 67 74 67 64V42C67 40 67.5 38.5 68 38Z"
          fill="#FDA4AF"
          stroke="#E11D48"
          strokeWidth="2"
        />
        {/* Bronchial branches */}
        <path d="M44 50L35 60M44 58L38 68" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
        <path d="M76 50L85 60M76 58L82 68" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
      </svg>
    );
  }

  // Sistem Kardiovaskular — Jantung & Sirkulasi
  if (cat.includes("kardiovaskular")) {
    return (
      <svg viewBox="0 0 120 100" width="110" height="92" fill="none" aria-hidden="true">
        <rect width="120" height="100" rx="14" fill="#FEF2F2" />
        <path
          d="M60 80C60 80 30 62 30 41C30 30 38 22 48 22C54 22 58 25 60 29C62 25 66 22 72 22C82 22 90 30 90 41C90 62 60 80 60 80Z"
          fill="#FECDD3"
          stroke="#DC2626"
          strokeWidth="2.2"
        />
        <path
          d="M36 52H47L52 40L58 62L64 46L69 52H84"
          stroke="#B91C1C"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Sistem Pencernaan — Lambung & Digestif
  if (cat.includes("pencernaan")) {
    return (
      <svg viewBox="0 0 120 100" width="110" height="92" fill="none" aria-hidden="true">
        <rect width="120" height="100" rx="14" fill="#FFFBEB" />
        <path
          d="M55 18V32C55 37 48 40 42 46C34 54 35 72 48 77C61 82 78 75 82 61C86 48 77 36 66 36C62 36 61 32 61 28V18"
          fill="#FDE68A"
          stroke="#D97706"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path d="M74 71C77 77 83 80 90 80" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  // Sistem Saraf & Kepala — Otak & Neurologi
  if (cat.includes("saraf") || cat.includes("mental")) {
    return (
      <svg viewBox="0 0 120 100" width="110" height="92" fill="none" aria-hidden="true">
        <rect width="120" height="100" rx="14" fill="#F5F3FF" />
        <path
          d="M46 28C36 28 29 36 29 46C29 50 31 54 33 57C31 61 32 68 38 72C44 76 54 74 58 69V33C55 30 51 28 46 28Z"
          fill="#DDD6FE"
          stroke="#6D28D9"
          strokeWidth="2"
        />
        <path
          d="M74 28C84 28 91 36 91 46C91 50 89 54 87 57C89 61 88 68 82 72C76 76 66 74 62 69V33C65 30 69 28 74 28Z"
          fill="#DDD6FE"
          stroke="#6D28D9"
          strokeWidth="2"
        />
        <path d="M40 46C45 43 49 48 53 45M67 45C71 48 75 43 80 46" stroke="#5B21B6" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  // Tulang & Sendi
  if (cat.includes("tulang") || cat.includes("sendi")) {
    return (
      <svg viewBox="0 0 120 100" width="110" height="92" fill="none" aria-hidden="true">
        <rect width="120" height="100" rx="14" fill="#ECFDF5" />
        <path
          d="M44 24C39 24 36 28 38 33C40 37 46 39 50 42L50 58C46 61 40 63 38 67C36 72 39 76 44 76C48 76 51 73 53 70H67C69 73 72 76 76 76C81 76 84 72 82 67C80 63 74 61 70 58V42C74 39 80 37 82 33C84 28 81 24 76 24C72 24 69 27 67 30H53C51 27 48 24 44 24Z"
          fill="#A7F3D0"
          stroke="#047857"
          strokeWidth="2"
        />
      </svg>
    );
  }

  // Default: Infeksi / Dermatologi / Metabolik / Ginjal — Medical Shield & Molecule
  return (
    <svg viewBox="0 0 120 100" width="110" height="92" fill="none" aria-hidden="true">
      <rect width="120" height="100" rx="14" fill="#ECFEFF" />
      <path
        d="M60 18L34 29V49C34 65 45 77 60 83C75 77 86 65 86 49V29L60 18Z"
        fill="#CFFAFE"
        stroke="#0E7490"
        strokeWidth="2.2"
      />
      <path d="M57 38H63V47H72V53H63V62H57V53H48V47H57V38Z" fill="#0E7490" />
    </svg>
  );
}
