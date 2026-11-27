from __future__ import annotations

import re

from ir_types import PreprocessingSteps

STOPWORDS: set[str] = {
    "yang", "di", "ke", "dari", "pada", "dalam", "untuk", "dengan", "oleh",
    "karena", "akibat", "secara", "tentang", "seperti", "yaitu", "yakni",
    "adalah", "merupakan", "dapat", "bisa", "akan", "telah", "sudah",
    "sedang", "masih", "selalu", "sering", "terkadang", "muncul", "terjadi",
    "mengalami", "dirasakan", "terasa", "gejala", "tanda", "kondisi", "pasien",
    "penderita", "penyakit", "gangguan", "kasus", "seseorang", "orang", "tubuh",
    "bagian", "antara", "lain", "hingga", "sampai", "serta", "juga", "hanya",
    "lebih", "kurang", "sangat", "cukup", "terus", "menerus", "kadang",
    "dan", "atau", "ini", "itu", "saat", "ketika", "jika", "bila",
    "namun", "tetapi", "tapi", "ada", "tidak", "bukan", "hari", "bulan", "tahun",
    "setelah", "sebelum", "selama", "tanpa", "melalui", "terhadap", "atas", "bawah",
}

BOOLEAN_KEYWORDS: set[str] = {
    "and", "or", "not", "dan", "atau", "bukan", "tidak", "(", ")",
}

MEDICAL_SLANG_DICT: dict[str, str] = {
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
    "dbd": "demam berdarah dengue dbd",
}

# Kata dasar medis yang dilindungi agar tidak ter-stemming secara keliru
PROTECTED_ROOTS: set[str] = {
    "demam", "batuk", "sesak", "bintik", "merah", "sakit", "kepala", "nyeri",
    "dada", "perut", "mual", "muntah", "pusing", "gatal", "bentol", "bengkak",
    "sendi", "jempol", "kaki", "mata", "kuning", "kulit", "lemas", "kering",
    "dahak", "malam", "berat", "turun", "haus", "kencing", "dingin", "keringat",
    "jantung", "napas", "paru", "darah", "infeksi", "virus", "bakteri", "radang",
    "tenggorokan", "amandel", "lambung", "usus", "ginjal", "hati", "saraf", "otot",
    "tulang", "ruam", "pilek", "flu", "influenza", "faringitis", "selesma",
    "diare", "kejang", "pingsan", "stroke", "alergi",
    "diabetes", "asma", "vertigo", "migrain", "hepatitis", "malaria", "dengue",
    "tifoid", "campak", "pandang", "kabur", "telinga", "hidung", "mulut", "lidah",
}

STEM_EXCEPTIONS: dict[str, str] = {
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
    "kesemutan": "semut",
}


def case_folding(text: str) -> str:
    return text.lower().strip() if text else ""


def normalize_text(text: str, preserve_boolean: bool = False) -> str:
    processed = case_folding(text)

    for slang, formal in sorted(MEDICAL_SLANG_DICT.items(), key=lambda kv: len(kv[0]), reverse=True):
        if preserve_boolean and " " not in slang and " " in formal:
            continue
        pattern = re.compile(rf"\b{re.escape(slang)}\b")
        processed = pattern.sub(formal, processed)

    if preserve_boolean:
        processed = re.sub(r"[^a-z0-9\s()]", " ", processed)
    else:
        processed = re.sub(r"[^a-z\s]", " ", processed)

    return re.sub(r"\s+", " ", processed).strip()


def tokenize(text: str, preserve_boolean: bool = False) -> list[str]:
    if not text:
        return []
    if preserve_boolean:
        return re.findall(r"\(|\)|[a-z0-9]+", text)
    return re.findall(r"\b[a-z0-9]+\b", text)


def remove_stopwords(tokens: list[str], preserve_boolean: bool = False) -> list[str]:
    cleaned: list[str] = []
    for token in tokens:
        if preserve_boolean and (token in BOOLEAN_KEYWORDS or token in ("(", ")")):
            cleaned.append(token)
        elif token not in STOPWORDS and len(token) > 1:
            cleaned.append(token)
    return cleaned


def stem_token(token: str) -> str:
    lower = token.lower()
    if len(lower) <= 2 or lower in BOOLEAN_KEYWORDS or lower in PROTECTED_ROOTS:
        return lower
    if lower in STEM_EXCEPTIONS:
        return STEM_EXCEPTIONS[lower]

    word = re.sub(r"(lah|kah|tah|pun|ku|mu|nya)$", "", lower)
    if word in PROTECTED_ROOTS:
        return word

    prefix_match = re.match(
        r"^(meng|meny|mem|men|me|peng|peny|pem|pen|ber|ter|per|di|ke|se)(.+)$", word
    )
    if prefix_match and len(prefix_match.group(2)) >= 4:
        candidate = prefix_match.group(2)
        if candidate in PROTECTED_ROOTS:
            return candidate
        word = candidate

    suffix_stripped = re.sub(r"(kan|an|i)$", "", word)
    if len(suffix_stripped) >= 4:
        word = suffix_stripped

    return word if len(word) >= 3 else lower


def stem_tokens(tokens: list[str], preserve_boolean: bool = False) -> list[str]:
    return [
        t if (preserve_boolean and (t in BOOLEAN_KEYWORDS or t in ("(", ")"))) else stem_token(t)
        for t in tokens
    ]


def preprocess_text(text: str, preserve_boolean: bool = False) -> list[str]:
    normalized = normalize_text(text, preserve_boolean)
    tokens = tokenize(normalized, preserve_boolean)
    filtered = remove_stopwords(tokens, preserve_boolean)
    return stem_tokens(filtered, preserve_boolean)


def inspect_preprocessing_steps(text: str) -> PreprocessingSteps:
    cf = case_folding(text)
    norm = normalize_text(text, False)
    tokens = tokenize(norm, False)
    stop_rem = remove_stopwords(tokens, False)
    stemmed = stem_tokens(stop_rem, False)
    return {
        "original": text,
        "case_folding": cf,
        "normalized": norm,
        "tokenized": tokens,
        "stopword_removed": stop_rem,
        "stemmed": stemmed,
        "token_count_before": len(tokens),
        "token_count_after": len(stemmed),
    }
