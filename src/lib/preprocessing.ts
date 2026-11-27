import type { PreprocessingSteps } from "./types";

const STOPWORDS = new Set<string>([
  "yang", "di", "ke", "dari", "pada", "dalam", "untuk", "dengan", "oleh",
  "karena", "akibat", "secara", "tentang", "seperti", "yaitu", "yakni",
  "adalah", "merupakan", "dapat", "bisa", "akan", "telah", "sudah",
  "sedang", "masih", "selalu", "sering", "terkadang", "muncul", "terjadi",
  "mengalami", "dirasakan", "terasa", "gejala", "tanda", "kondisi", "pasien",
  "penderita", "penyakit", "gangguan", "kasus", "seseorang", "orang", "tubuh",
  "bagian", "antara", "lain", "hingga", "sampai", "serta", "juga", "hanya",
  "lebih", "kurang", "sangat", "cukup", "terus", "menerus", "kadang",
  "dan", "atau", "ini", "itu", "atau", "saat", "ketika", "jika", "bila",
  "namun", "tetapi", "tapi", "ada", "tidak", "bukan", "hari", "bulan", "tahun",
  "setelah", "sebelum", "selama", "tanpa", "melalui", "terhadap", "atas", "bawah"
]);

const BOOLEAN_KEYWORDS = new Set<string>([
  "and", "or", "not", "dan", "atau", "bukan", "tidak", "(", ")"
]);

export const MEDICAL_SLANG_DICT: Record<string, string> = {
  "meriang": "demam",
  "puyeng": "pusing",
  "keliyengan": "pusing melayang",
  "kliyengan": "pusing melayang",
  "mual-mual": "mual",
  "muntah-muntah": "muntah",
  "bab": "buang air besar",
  "bak": "buang air kecil",
  "kencing": "kencing urine",
  "panas": "demam tinggi",
  "menggigil": "gigil",
  "sesek": "sesak",
  "pileg": "pilek",
  "pilek": "pilek selesma",
  "flu": "flu influenza",
  "batuk2": "batuk",
  "batuk-batuk": "batuk",
  "gatel": "gatal",
  "gatel-gatel": "gatal",
  "bentol2": "bentol",
  "capek": "lelah",
  "lemes": "lemas",
  "pegel": "pegal linu",
  "ngik-ngik": "mengi",
  "mengi": "mengi wheezing",
  "ambeyen": "wasir hemoroid",
  "mencret": "diare",
  "migren": "migrain",
  "serangan jantung": "infark miokard jantung",
  "usus buntu": "apendisitis usus buntu",
  "asam urat": "gout arthritis asam urat",
  "darah tinggi": "hipertensi",
  "kencing manis": "diabetes melitus",
  "tbc": "tuberkulosis paru tbc",
  "tb": "tuberkulosis tbc",
  "dbd": "demam berdarah dengue dbd"
};

// Kata dasar medis yang dilindungi agar tidak ter-stemming secara keliru
const PROTECTED_ROOTS = new Set<string>([
  "demam", "batuk", "sesak", "bintik", "merah", "sakit", "kepala", "nyeri",
  "dada", "perut", "mual", "muntah", "pusing", "gatal", "bentol", "bengkak",
  "sendi", "jempol", "kaki", "mata", "kuning", "kulit", "lemas", "kering",
  "dahak", "malam", "berat", "turun", "haus", "kencing", "dingin", "keringat",
  "jantung", "napas", "paru", "darah", "infeksi", "virus", "bakteri", "radang",
  "tenggorokan", "amandel", "lambung", "usus", "ginjal", "hati", "saraf", "otot",
  "tulang", "ruam", "pilek", "flu", "influenza", "faringitis", "selesma",
  "diare", "kejang", "pingsan", "stroke", "alergi",
  "diabetes", "asma", "vertigo", "migrain", "hepatitis", "malaria", "dengue",
  "tifoid", "campak", "pandang", "kabur", "telinga", "hidung", "mulut", "lidah"
]);

const STEM_EXCEPTIONS: Record<string, string> = {
  "merasakan": "rasa",
  "dirasakan": "rasa",
  "menggigil": "gigil",
  "berdarah": "darah",
  "pendarahan": "darah",
  "perdarahan": "darah",
  "kemerahan": "merah",
  "pembengkakan": "bengkak",
  "membengkak": "bengkak",
  "kekuningan": "kuning",
  "penurunan": "turun",
  "menurun": "turun",
  "berputar": "putar",
  "penciuman": "cium",
  "pernafasan": "napas",
  "pernapasan": "napas",
  "bernapas": "napas",
  "berkeringat": "keringat",
  "berdahak": "dahak",
  "makanan": "makan",
  "memakan": "makan",
  "sebelah": "belah",
  "berlebihan": "lebih",
  "berulang": "ulang",
  "menjalar": "jalar",
  "menelan": "telan",
  "berjalan": "jalan",
  "kehilangan": "hilang",
  "hilangnya": "hilang",
  "kelumpuhan": "lumpuh",
  "kesemutan": "semut"
};

export function caseFolding(text: string): string {
  return text ? text.toLowerCase().trim() : "";
}

export function normalizeText(text: string, preserveBoolean = false): string {
  let processed = caseFolding(text);

  for (const [slang, formal] of Object.entries(MEDICAL_SLANG_DICT)) {
    // Dalam mode Boolean, hindari ekspansi 1 kata menjadi multi-kata agar jumlah operand tetap konsisten
    if (preserveBoolean && !slang.includes(" ") && formal.includes(" ")) {
      continue;
    }
    const escaped = slang.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    processed = processed.replace(regex, formal);
  }

  if (preserveBoolean) {
    processed = processed.replace(/[^a-z0-9\s()]/g, " ");
  } else {
    processed = processed.replace(/[^a-z\s]/g, " ");
  }

  return processed.replace(/\s+/g, " ").trim();
}

export function tokenize(text: string, preserveBoolean = false): string[] {
  if (!text) return [];
  if (preserveBoolean) {
    return text.match(/\(|\)|[a-z0-9]+/g) ?? [];
  }
  return text.match(/\b[a-z0-9]+\b/g) ?? [];
}

export function removeStopwords(tokens: string[], preserveBoolean = false): string[] {
  const cleaned: string[] = [];
  for (const token of tokens) {
    if (preserveBoolean && (BOOLEAN_KEYWORDS.has(token) || token === "(" || token === ")")) {
      cleaned.push(token);
    } else if (!STOPWORDS.has(token) && token.length > 1) {
      cleaned.push(token);
    }
  }
  return cleaned;
}

export function stemToken(token: string): string {
  const lower = token.toLowerCase();
  if (lower.length <= 2 || BOOLEAN_KEYWORDS.has(lower) || PROTECTED_ROOTS.has(lower)) {
    return lower;
  }
  if (STEM_EXCEPTIONS[lower]) {
    return STEM_EXCEPTIONS[lower];
  }

  let word = lower;
  // Particle & possessive suffixes
  word = word.replace(/(lah|kah|tah|pun|ku|mu|nya)$/, "");
  if (PROTECTED_ROOTS.has(word)) return word;

  // Derivational prefixes
  const prefixMatch = word.match(/^(meng|meny|mem|men|me|peng|peny|pem|pen|ber|ter|per|di|ke|se)(.+)$/);
  if (prefixMatch && prefixMatch[2].length >= 4) {
    const candidate = prefixMatch[2];
    if (PROTECTED_ROOTS.has(candidate)) return candidate;
    word = candidate;
  }

  // Derivational suffixes (-kan, -an, -i)
  const suffixStripped = word.replace(/(kan|an|i)$/, "");
  if (suffixStripped.length >= 4) {
    word = suffixStripped;
  }

  return word.length >= 3 ? word : lower;
}

export function stemTokens(tokens: string[], preserveBoolean = false): string[] {
  return tokens.map((token) => {
    if (preserveBoolean && (BOOLEAN_KEYWORDS.has(token) || token === "(" || token === ")")) {
      return token;
    }
    return stemToken(token);
  });
}

export function preprocessText(text: string, preserveBoolean = false): string[] {
  const normalized = normalizeText(text, preserveBoolean);
  const tokens = tokenize(normalized, preserveBoolean);
  const filtered = removeStopwords(tokens, preserveBoolean);
  return stemTokens(filtered, preserveBoolean);
}

export function inspectPreprocessingSteps(text: string): PreprocessingSteps {
  const cf = caseFolding(text);
  const norm = normalizeText(text, false);
  const tokens = tokenize(norm, false);
  const stopRem = removeStopwords(tokens, false);
  const stemmed = stemTokens(stopRem, false);

  return {
    original: text,
    case_folding: cf,
    normalized: norm,
    tokenized: tokens,
    stopword_removed: stopRem,
    stemmed,
    token_count_before: tokens.length,
    token_count_after: stemmed.length
  };
}
