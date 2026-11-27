"""
Reproducible Corpus Builder for MediTemu (MedlinePlus NIH / NLM XML -> medical_dataset.json)
Source: https://medlineplus.gov/xml.html (Public Domain, U.S. National Library of Medicine)

Usage:
  python scripts/build_medlineplus_corpus.py --xml path/to/mplus_topics_2026-11-26.xml
"""

import argparse
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

# 1-to-1 verified mapping from MediTemu doc_id -> MedlinePlus English Health Topic ID
MEDLINEPLUS_MAPPING: dict[str, str] = {
    "MED-001": "3104",  # Dengue
    "MED-002": "315",   # Malaria
    "MED-003": "1213",  # Salmonella Infections (incl. Typhoid fever)
    "MED-004": "318",   # Measles
    "MED-005": "182",   # Chickenpox
    "MED-006": "3181",  # COVID-19 (Coronavirus Disease 2019)
    "MED-007": "6345",  # Chikungunya
    "MED-008": "1241",  # Listeria Infections
    "MED-009": "523",   # Rabies
    "MED-010": "1512",  # Diphtheria
    "MED-011": "435",   # Tetanus
    "MED-012": "334",   # Mumps
    "MED-013": "298",   # Infectious Mononucleosis
    "MED-014": "461",   # Whooping Cough (Pertussis)
    "MED-015": "299",   # Flu (Influenza)
    "MED-016": "41",    # Tuberculosis
    "MED-017": "2",     # Asthma
    "MED-018": "363",   # Pneumonia
    "MED-019": "5755",  # Acute Bronchitis
    "MED-020": "27",    # COPD
    "MED-021": "4748",  # Sore Throat (Pharyngitis)
    "MED-022": "404",   # Sinusitis
    "MED-023": "1650",  # Voice Disorders (Laryngitis)
    "MED-024": "4627",  # Pleural Disorders (Pleurisy)
    "MED-025": "3623",  # Emphysema
    "MED-026": "5",     # Heart Attack
    "MED-027": "199",   # Heart Failure
    "MED-028": "142",   # Angina
    "MED-029": "34",    # High Blood Pressure
    "MED-030": "4964",  # Atrial Fibrillation
    "MED-031": "6248",  # Ischemic Stroke
    "MED-032": "1683",  # Deep Vein Thrombosis
    "MED-033": "3754",  # Cardiomyopathy
    "MED-034": "1225",  # Low Blood Pressure
    "MED-035": "4083",  # Peripheral Arterial Disease
    "MED-036": "512",   # GERD
    "MED-037": "420",   # Stomach Disorders
    "MED-038": "1223",  # Appendicitis
    "MED-039": "3056",  # Gastroenteritis
    "MED-040": "4643",  # Gallstones
    "MED-041": "5876",  # Pancreatitis
    "MED-042": "1686",  # Hepatitis A
    "MED-043": "1687",  # Hepatitis B
    "MED-044": "190",   # Cirrhosis
    "MED-045": "357",   # Peptic Ulcer
    "MED-046": "1226",  # Hemorrhoids
    "MED-047": "614",   # Irritable Bowel Syndrome
    "MED-048": "5275",  # Intestinal Obstruction
    "MED-049": "4293",  # Indigestion
    "MED-050": "446",   # Ulcerative Colitis
    "MED-051": "216",   # Dizziness and Vertigo
    "MED-052": "3157",  # Migraine
    "MED-053": "273",   # Headache
    "MED-054": "324",   # Meningitis
    "MED-055": "1219",  # Bell's Palsy
    "MED-056": "244",   # Epilepsy
    "MED-057": "85",    # Parkinson's Disease
    "MED-058": "1570",  # Transient Ischemic Attack
    "MED-059": "2729",  # Trigeminal Neuralgia
    "MED-060": "4867",  # Concussion
    "MED-061": "264",   # Gout
    "MED-062": "1250",  # Osteoarthritis
    "MED-063": "1232",  # Rheumatoid Arthritis
    "MED-064": "284",   # Herniated Disk
    "MED-065": "179",   # Carpal Tunnel Syndrome
    "MED-066": "37",    # Osteoporosis
    "MED-067": "143",   # Ankylosing Spondylitis
    "MED-068": "3650",  # Heel Injuries and Disorders
    "MED-069": "1618",  # Tendinitis
    "MED-070": "32",    # Fibromyalgia
    "MED-071": "289",   # Hives (Urticaria)
    "MED-072": "6257",  # Anaphylaxis
    "MED-073": "1215",  # Eczema
    "MED-074": "373",   # Psoriasis
    "MED-075": "1254",  # Scabies
    "MED-076": "90",    # Shingles
    "MED-077": "1228",  # Tinea Infections
    "MED-078": "1256",  # Food Allergy
    "MED-079": "321",   # Melanoma
    "MED-080": "1253",  # Impetigo
    "MED-081": "5930",  # Diabetes Type 2
    "MED-082": "6125",  # Hyperglycemia
    "MED-083": "6177",  # Hyperthyroidism
    "MED-084": "6175",  # Hypothyroidism
    "MED-085": "3528",  # Metabolic Syndrome
    "MED-086": "448",   # Urinary Tract Infections
    "MED-087": "91",    # Kidney Diseases
    "MED-088": "1224",  # Kidney Stones
    "MED-089": "302",   # Kidney Failure
    "MED-090": "5987",  # Chronic Kidney Disease
    "MED-091": "115",   # Ear Infections
    "MED-092": "1545",  # Ear Disorders
    "MED-093": "4746",  # Hay Fever
    "MED-094": "4946",  # Pink Eye
    "MED-095": "42",    # Glaucoma
    "MED-096": "5404",  # Eyelid Disorders
    "MED-097": "247",   # Eye Diseases
    "MED-098": "116",   # Cataract
    "MED-099": "6440",  # Tonsillitis
    "MED-100": "1236",  # Tinnitus
    "MED-101": "601",   # Panic Disorder
    "MED-102": "144",   # Anxiety
    "MED-103": "113",   # Depression
    "MED-104": "6055",  # Insomnia
    "MED-105": "6159",  # Psoriatic Arthritis
    "MED-106": "1258",  # Giardia Infections
    "MED-107": "211",   # Diarrhea
    "MED-108": "139",   # Anemia
    "MED-109": "82",    # Lupus
    "MED-110": "1505",  # Spine Injuries and Disorders
    "MED-111": "5977",  # Bronchial Disorders
    "MED-112": "1660",  # Throat Disorders
    "MED-113": "1400",  # Nose Injuries and Disorders
    "MED-114": "237",   # Eating Disorders
    "MED-115": "600",   # Bipolar Disorder
    "MED-116": "3787",  # Bile Duct Diseases
    "MED-117": "532",   # Nail Diseases
    "MED-118": "1227",  # Cellulitis
    "MED-119": "471",   # Obsessive-Compulsive Disorder
    "MED-120": "3210",  # Sepsis
    "MED-121": "310",   # Liver Diseases
    "MED-122": "5603",  # Drug Reactions
    "MED-123": "1",     # HIV
    "MED-124": "6263",  # Hemorrhagic Stroke
    "MED-125": "4452",  # Jaundice
    "MED-126": "1286",  # Hepatitis C
    "MED-127": "109",   # Hepatitis
    "MED-128": "119",   # Crohn's Disease
    "MED-129": "6465",  # Steatotic Liver Disease
    "MED-130": "196",   # Common Cold
    "MED-131": "540",   # Varicose Veins
    "MED-132": "1264",  # Hypoglycemia
    "MED-133": "124",   # Acne
    "MED-134": "5709",  # Cholera
    "MED-135": "377",   # Pulmonary Embolism
}

# Updates and new entries aligned strictly with MedlinePlus Health Topics XML content
OVERRIDES: dict[str, dict] = {
    "MED-003": {
        "disease_name": "Infeksi Salmonella & Demam Tifoid (Salmonellosis)",
        "category": "Infeksi Tropis & Virus",
        "symptoms": "Demam, kram perut, diare, sakit kepala, mual, muntah, dan hilangnya nafsu makan yang umumnya berlangsung 4 hingga 7 hari; pada demam tifoid demam berlangsung lebih berat dan berkepanjangan.",
        "description": "Infeksi bakteri Salmonella yang umumnya berasal dari unggas, telur, daging mentah, atau sayur dan buah yang tidak dicuci bersih. Varian bakteri Salmonella tertentu juga menyebabkan demam tifoid yang lebih serius.",
        "precaution": "Jaga hidrasi tubuh akibat diare, konsumsi makanan matang higienis, cuci tangan setelah menyentuh hewan peliharaan atau bahan mentah. Segera ke dokter untuk tes feses dan antibiotik bila infeksi berat.",
        "urgency_level": "Sedang",
    },
    "MED-008": {
        "disease_name": "Infeksi Listeria (Listeriosis)",
        "category": "Infeksi Tropis & Virus",
        "symptoms": "Demam, nyeri otot, mual, diare, serta pada kasus yang menyebar ke sistem saraf dapat timbul sakit kepala hebat, leher kaku, kebingungan, kehilangan keseimbangan, hingga kejang.",
        "description": "Penyakit bawaan makanan akibat bakteri Listeria monocytogenes yang ditemukan di tanah, air, makanan mentah, atau produk susu tidak terpasteurisasi dan mampu bertahan pada suhu lemari es.",
        "precaution": "Masak daging hingga matang, cuci buah dan sayur mentah, hindari susu tidak terpasteurisasi terutama bagi ibu hamil, lansia, dan individu dengan daya tahan tubuh lemah. Segera konsultasi ke dokter untuk terapi antibiotik.",
        "urgency_level": "Darurat",
    },
    "MED-015": {
        "disease_name": "Influenza (Flu Musiman)",
        "category": "Sistem Pernapasan",
        "symptoms": "Demam atau rasa meriang menggigil yang muncul mendadak, batuk, sakit tenggorokan, hidung meler atau tersumbat, nyeri otot dan badan, sakit kepala, kelelahan ekstrem, serta kadang mual atau muntah.",
        "description": "Infeksi saluran pernapasan akut yang disebabkan oleh virus influenza yang menular melalui percikan droplet saat penderita batuk, bersin, atau berbicara. Gejalanya datang lebih mendadak dan berat dibanding pilek biasa.",
        "precaution": "Istirahat cukup di rumah, perbanyak minum air putih untuk mencegah dehidrasi, hindari kontak dekat untuk mencegah penularan, serta dapatkan vaksinasi flu tahunan. Segera ke fasilitas kesehatan bila sesak napas atau demam tinggi menetap.",
        "urgency_level": "Sedang",
    },
    "MED-021": {
        "disease_name": "Faringitis Akut (Radang Tenggorokan)",
        "category": "Sistem Pernapasan",
        "symptoms": "Tenggorokan terasa nyeri, perih, gatal, dan sakit saat menelan, demam, batuk, suara serak, pembengkakan amandel atau kelenjar leher akibat infeksi virus seperti flu dan pilek maupun bakteri strep throat.",
        "description": "Peradangan pada faring atau saluran tenggorokan yang menghubungkan rongga hidung dan mulut dengan kerongkongan dan saluran napas. Penyebab tersering meliputi infeksi virus saluran napas, alergi, dan infeksi bakteri Streptococcus.",
        "precaution": "Minum banyak cairan hangat, berkumur dengan air garam hangat, hisap permen pelega tenggorokan, dan hindari asap rokok. Periksakan ke dokter bila nyeri menelan hebat atau disertai demam tinggi.",
        "urgency_level": "Ringan",
    },
    "MED-023": {
        "disease_name": "Laringitis & Gangguan Pita Suara (Voice Disorders)",
        "category": "Sistem Pernapasan",
        "symptoms": "Suara serak, parau, lemah atau hilang sama sekali, rasa mengganjal atau kering di tenggorokan, batuk kering ringan, serta kelelahan saat berbicara akibat peradangan pita suara.",
        "description": "Gangguan pada laring (kotak suara) yang membuat pita suara membengkak atau teriritasi sehingga getaran suara berubah. Sering dipicu oleh laringitis virus, penggunaan suara berlebihan, refluks asam, atau paparan asap.",
        "precaution": "Istirahatkan pita suara (kurangi berbicara keras atau berbisik), minum air putih yang cukup, gunakan pelembab udara, dan hindari merokok. Konsultasikan ke dokter THT jika suara serak bertahan lebih dari dua minggu.",
        "urgency_level": "Ringan",
    },
    "MED-024": {
        "disease_name": "Pleuritis & Gangguan Pleura (Pleural Disorders)",
        "category": "Sistem Pernapasan",
        "symptoms": "Nyeri dada tajam yang bertambah parah saat menarik napas dalam atau batuk, sesak napas, napas pendek cepat, demam bila disertai infeksi, dan rasa tidak nyaman di salah satu sisi dada.",
        "description": "Peradangan atau penumpukan cairan/udara pada lapisan pleura yang membungkus paru-paru dan melapisi rongga dada (termasuk pleuritis dan efusi pleura).",
        "precaution": "Hindari aktivitas fisik berat dan segera periksakan diri ke dokter untuk pemeriksaan rontgen dada. Segera menuju IGD bila muncul sesak napas mendadak yang berat atau nyeri dada menjalar.",
        "urgency_level": "Darurat",
    },
    "MED-033": {
        "disease_name": "Kardiomiopati (Kelainan Otot Jantung)",
        "category": "Sistem Kardiovaskular",
        "symptoms": "Sesak napas saat beraktivitas maupun berbaring, kelelahan berat, pembengkakan pada tungkai dan pergelangan kaki, detak jantung berdebar tidak teratur, pusing, hingga nyeri dada.",
        "description": "Kelainan pada otot jantung yang menyebabkan otot jantung membesar, menebal, atau menjadi kaku sehingga kemampuan jantung memompa darah ke seluruh tubuh menurun.",
        "precaution": "Batasi asupan garam sesuai anjuran dokter, hindari alkohol dan aktivitas fisik berat tanpa pengawasan medis, serta patuhi kontrol kardiologi rutin. Segera ke IGD jika mengalami sesak napas berat atau pingsan.",
        "urgency_level": "Darurat",
    },
    "MED-037": {
        "disease_name": "Gastritis & Gangguan Lambung (Stomach Disorders)",
        "category": "Sistem Pencernaan",
        "symptoms": "Nyeri atau rasa perih terbakar di ulu hati (perut bagian atas), mual, muntah, kembung, cepat kenyang saat makan, bersendawa, dan hilangnya nafsu makan.",
        "description": "Gangguan pada lambung termasuk peradangan mukosa lambung (gastritis), infeksi H. pylori, atau iritasi akibat asam lambung dan obat antiinflamasi.",
        "precaution": "Makan dalam porsi kecil tetapi lebih sering, hindari makanan pedas, asam, kafein, serta obat pereda nyeri NSAID tanpa anjuran dokter. Segera periksa bila muntah darah atau tinja berwarna hitam.",
        "urgency_level": "Sedang",
    },
    "MED-060": {
        "disease_name": "Gegar Otak Ringan hingga Sedang (Concussion)",
        "category": "Sistem Saraf & Kepala",
        "symptoms": "Sakit kepala berdenyut, pusing berputar, kebingungan sementara, mual atau muntah, gangguan keseimbangan, sensitif terhadap cahaya dan suara, pandangan kabur, serta sulit berkonsentrasi setelah benturan kepala.",
        "description": "Cedera otak traumatis akibat benturan atau guncangan mendadak pada kepala yang menyebabkan otak bergerak cepat di dalam tengkorak dan mengganggu fungsi saraf sementara.",
        "precaution": "Hentikan aktivitas olahraga atau kerja segera setelah benturan, istirahatkan fisik dan kognitif, serta pantau tanda bahaya. Segera menuju IGD jika terjadi penurunan kesadaran, muntah berulang, kejang, atau sakit kepala makin memburuk.",
        "urgency_level": "Darurat",
    },
    "MED-068": {
        "disease_name": "Nyeri Tumit & Fasciitis Plantaris (Heel Disorders)",
        "category": "Tulang & Sendi",
        "symptoms": "Nyeri tajam menusuk di bagian bawah atau belakang tumit terutama saat melangkah pertama kali di pagi hari, kekakuan pada telapak kaki, pembengkakan ringan, dan nyeri meningkat setelah berdiri lama.",
        "description": "Gangguan dan peradangan pada tulang tumit serta jaringan ikat penyangga telapak kaki (termasuk fasciitis plantaris dan tendinitis Achilles) akibat tekanan berlebih saat berjalan, berlari, atau alas kaki yang tidak menopang.",
        "precaution": "Istirahatkan kaki dari aktivitas berdampak tinggi, kompres es 15–20 menit pada tumit, lakukan peregangan betis dan telapak kaki perlahan, serta gunakan alas kaki dengan bantalan lengkung yang baik.",
        "urgency_level": "Ringan",
    },
    "MED-078": {
        "disease_name": "Alergi Makanan & Reaksi Kulit Alergi (Food Allergy)",
        "category": "Dermatologi & Alergi",
        "symptoms": "Gatal-gatal dan bentol merah biduran pada kulit, kesemutan atau gatal di mulut, pembengkakan bibir, wajah, atau lidah, sakit perut, mual muntah setelah mengonsumsi makanan laut, kacang, telur, atau susu.",
        "description": "Reaksi abnormal sistem kekebalan tubuh yang keliru menganggap protein makanan tertentu sebagai zat berbahaya, memicu pelepasan histamin pada kulit, saluran cerna, hingga saluran napas.",
        "precaution": "Hentikan konsumsi makanan pemicu alergi dan catat riwayat makanan penyebabnya. Segera menuju IGD atau gunakan epinefrin bila timbul sesak napas, suara serak, atau pembengkakan tenggorokan.",
        "urgency_level": "Darurat",
    },
    "MED-082": {
        "disease_name": "Hiperglikemia & Krisis Diabetes (Hyperglycemia)",
        "category": "Metabolik & Endokrin",
        "symptoms": "Rasa haus berlebihan (polidipsia), sering buang air kecil (poliuria), penurunan berat badan tanpa sebab jelas, kelelahan berat, pandangan kabur, mual, muntah, dan napas berbau buah pada kondisi ketoasidosis.",
        "description": "Kondisi ketika kadar glukosa (gula) dalam darah meningkat terlalu tinggi akibat kurangnya produksi atau efektivitas hormon insulin. Hiperglikemia berat yang tidak terkontrol dapat memicu ketoasidosis diabetik.",
        "precaution": "Pantau kadar gula darah secara berkala, patuhi jadwal obat atau insulin dari dokter, minum cukup air putih tanpa gula, dan segera ke IGD jika gula darah sangat tinggi disertai muntah atau napas cepat.",
        "urgency_level": "Darurat",
    },
    "MED-087": {
        "disease_name": "Penyakit & Infeksi Ginjal (Kidney Diseases)",
        "category": "Ginjal & Saluran Kemih",
        "symptoms": "Nyeri pinggang atau punggung bawah di salah satu sisi, demam menggigil, nyeri atau rasa panas saat buang air kecil, urine keruh atau kemerahan, mual muntah, pembengkakan di kaki dan sekitar mata.",
        "description": "Gangguan fungsi maupun infeksi pada ginjal (termasuk pielonefritis dan nefritis) yang dapat merusak unit penyaring ginjal bila tidak ditangani cepat.",
        "precaution": "Minum air putih yang cukup, jangan menahan buang air kecil, hindari konsumsi obat pereda nyeri sembarangan yang membebani ginjal, dan segera periksakan diri ke dokter untuk pemeriksaan urine serta fungsi ginjal.",
        "urgency_level": "Darurat",
    },
    "MED-092": {
        "disease_name": "Gangguan & Infeksi Telinga Luar (Ear Disorders)",
        "category": "THT & Mata",
        "symptoms": "Nyeri telinga yang bertambah saat daun telinga ditarik atau ditekan, gatal di liang telinga, keluarnya cairan bening atau keruh, rasa penuh tersumbat, dan pendengaran sedikit berkurang.",
        "description": "Berbagai gangguan pada struktur telinga termasuk infeksi saluran telinga luar (otitis eksterna / swimmer's ear), penumpukan serumen, atau iritasi akibat kelembapan.",
        "precaution": "Jaga telinga tetap kering saat mandi atau berenang, hindari mengorek telinga dengan cotton bud atau benda tajam, dan gunakan tetes telinga sesuai resep dokter.",
        "urgency_level": "Ringan",
    },
    "MED-096": {
        "disease_name": "Kelainan Kelopak Mata & Bintitan (Eyelid Disorders)",
        "category": "THT & Mata",
        "symptoms": "Benjolan kecil kemerahan dan nyeri di tepi kelopak mata (bintitan), kelopak mata bengkak, mata berair, gatal atau terasa mengganjal saat berkedip, serta kerak ringan di pangkal bulu mata.",
        "description": "Peradangan atau infeksi kelenjar minyak di kelopak mata (seperti hordeolum/bintitan, kalazion, dan blefaritis) serta gangguan posisi kelopak mata.",
        "precaution": "Kompres hangat bersih selama 10–15 menit beberapa kali sehari, cuci tangan sebelum menyentuh area mata, jangan memencet benjolan, dan hindari memakai riasan mata atau lensa kontak sementara.",
        "urgency_level": "Ringan",
    },
    "MED-097": {
        "disease_name": "Penyakit Mata & Sindrom Mata Kering (Eye Diseases)",
        "category": "THT & Mata",
        "symptoms": "Mata terasa perih, kering, panas, atau seperti berpasir, kemerahan ringan, mata mudah lelah saat menatap layar, penglihatan kadang buram sementara, serta sensitif terhadap cahaya atau angin.",
        "description": "Gangguan pada permukaan dan jaringan mata termasuk sindrom mata kering (dry eye) akibat kurangnya produksi atau kualitas air mata serta kelainan refraksi atau iritasi mata.",
        "precaution": "Gunakan tetes air mata buatan (artificial tears) bebas pengawet, istirahatkan mata secara berkala dengan aturan 20-20-20 saat bekerja di depan layar, dan periksa ke dokter mata bila nyeri atau gangguan penglihatan menetap.",
        "urgency_level": "Ringan",
    },
    "MED-110": {
        "disease_name": "Gangguan Tulang Belakang & Nyeri Leher (Spine Disorders)",
        "category": "Tulang & Sendi",
        "symptoms": "Nyeri dan kaku pada leher atau punggung, nyeri menjalar ke bahu, lengan, atau tungkai, kesemutan atau mati rasa pada jari, serta keterbatasan gerak saat menoleh atau membungkuk.",
        "description": "Kelainan struktural dan degeneratif pada tulang belakang (termasuk spondilosis servikal, stenosis spinal, dan iritasi akar saraf) akibat penuaan sendi, postur kurang baik, atau cedera.",
        "precaution": "Perbaiki postur ergonomis saat duduk dan menggunakan gawai, lakukan peregangan leher ringan, kompres hangat pada otot tegang, dan segera konsultasi dokter jika timbul kelemahan otot atau kesemutan berat.",
        "urgency_level": "Sedang",
    },
    "MED-111": {
        "disease_name": "Gangguan Bronkus & Bronkiektasis (Bronchial Disorders)",
        "category": "Sistem Pernapasan",
        "symptoms": "Batuk kronis berdahak kental setiap hari, sesak napas, napas berbunyi mengi, rasa nyeri atau tertekan di dada, mudah lelah, serta kadang dahak bercampur bercak darah.",
        "description": "Kelainan pada saluran bronkus yang membawa udara ke paru-paru, termasuk pelebaran permanen saluran napas (bronkiektasis) atau peradangan bronkus kronis yang memicu penumpukan lendir.",
        "precaution": "Perbanyak minum air hangat untuk mengencerkan dahak, hindari paparan asap rokok dan polusi udara, ikuti fisioterapi dada atau latihan pernapasan sesuai anjuran dokter paru.",
        "urgency_level": "Sedang",
    },
    "MED-112": {
        "disease_name": "Gangguan Tenggorokan & Abses Leher (Throat Disorders)",
        "category": "THT & Mata",
        "symptoms": "Sakit tenggorokan parah di satu sisi, sangat sulit atau sakit saat menelan, suara berubah serak atau bergumam, demam tinggi, sulit membuka mulut lebar, dan pembengkakan kelenjar leher.",
        "description": "Gangguan dan infeksi berat pada jaringan tenggorokan dan area sekitar amandel (termasuk abses peritonsil dan gangguan faring-laring) yang memerlukan evaluasi THT segera.",
        "precaution": "Jangan menunda pemeriksaan ke dokter atau IGD bila muncul kesulitan menelan cairan, air liur menetes, atau sesak napas karena pembengkakan tenggorokan.",
        "urgency_level": "Darurat",
    },
    "MED-113": {
        "disease_name": "Gangguan Hidung & Polip Nasal (Nose Disorders)",
        "category": "THT & Mata",
        "symptoms": "Hidung tersumbat kronis, penciuman menurun atau hilang, pilek berkepanjangan, bernapas lewat mulut saat tidur, nyeri tekan di sekitar wajah atau dahi, dan sakit kepala ringan.",
        "description": "Gangguan pada rongga hidung termasuk pertumbuhan jaringan lunak jinak (polip hidung), deviasi septum, atau peradangan mukosa hidung kronis yang menyumbat aliran udara.",
        "precaution": "Bilas hidung dengan larutan salin steril secara teratur, hindari alergen dan asap rokok, serta konsultasikan ke dokter THT untuk evaluasi semprot kortikosteroid hidung atau tindakan medis bila perlu.",
        "urgency_level": "Ringan",
    },
    "MED-114": {
        "disease_name": "Gangguan Makan: Anoreksia & Bulimia (Eating Disorders)",
        "category": "Kesehatan Mental & Psikosomatis",
        "symptoms": "Ketakutan berlebihan terhadap kenaikan berat badan, pembatasan makan ekstrem, episode makan berlebihan lepas kendali yang diikuti muntah paksa atau penggunaan pencahar, kelelahan, pusing, dan perubahan berat badan drastis.",
        "description": "Gangguan kesehatan mental serius yang ditandai perilaku makan tidak sehat dan gangguan persepsi bentuk tubuh, meliputi anoreksia nervosa, bulimia nervosa, dan binge-eating disorder.",
        "precaution": "Dukung penderita tanpa menghakimi dan segera libatkan dokter, psikiater atau psikolog klinis, serta ahli gizi untuk pemulihan fisik dan psikologis terpadu.",
        "urgency_level": "Sedang",
    },
    "MED-115": {
        "disease_name": "Gangguan Bipolar (Bipolar Disorder)",
        "category": "Kesehatan Mental & Psikosomatis",
        "symptoms": "Perubahan suasana hati ekstrem yang bergantian antara fase mania (sangat berenergi, euforia, bicara cepat, kurang tidur, impulsif) dan fase depresi (sedih mendalam, kehilangan minat, putus asa, kelelahan).",
        "description": "Gangguan suasana hati (mood disorder) kronis yang menyebabkan fluktuasi tajam pada energi, konsentrasi, aktivitas harian, dan kemampuan mengambil keputusan.",
        "precaution": "Konsultasi dengan psikiater untuk terapi penstabil suasana hati dan psikoterapi rutin, jaga pola tidur teratur, hindari alkohol/narkotika, dan segera cari bantuan darurat bila muncul pikiran menyakiti diri.",
        "urgency_level": "Sedang",
    },
    "MED-116": {
        "disease_name": "Penyakit Saluran Empedu & Kolangitis (Bile Duct Diseases)",
        "category": "Sistem Pencernaan",
        "symptoms": "Nyeri perut kanan atas yang tajam, demam tinggi disertai menggigil, kulit dan bagian putih mata menguning (jaundice), urine berwarna gelap seperti teh, serta mual muntah.",
        "description": "Peradangan, infeksi (kolangitis), atau penyumbatan pada saluran empedu yang mengalirkan cairan empedu dari hati ke usus halus.",
        "precaution": "Segera menuju IGD atau dokter spesialis penyakit dalam bila demam tinggi muncul bersamaan dengan nyeri perut kanan atas dan mata kuning, karena kondisi ini membutuhkan penanganan antibiotik dan dekompresi empedu cepat.",
        "urgency_level": "Darurat",
    },
    "MED-117": {
        "disease_name": "Kelainan Kuku & Infeksi Kuku (Nail Diseases)",
        "category": "Dermatologi & Alergi",
        "symptoms": "Perubahan warna kuku menjadi kekuningan atau keputihan, kuku menebal rapuh atau mudah terkelupas, permukaan kuku berbintik cekung (pitting), nyeri atau kemerahan bengkak di kulit sekitar kuku.",
        "description": "Kelainan pada lempeng dan dasar kuku akibat infeksi jamur kuku, cedera berulang, infeksi bakteri di lipatan kuku, atau penyakit kulit seperti psoriasis kuku.",
        "precaution": "Jaga kuku tetap pendek, bersih, dan kering, hindari memotong kutikula terlalu dalam atau memakai sepatu sempit lembap, dan konsultasikan ke dokter kulit jika perubahan kuku meluas atau bernanah.",
        "urgency_level": "Ringan",
    },
    "MED-118": {
        "disease_name": "Selulitis (Infeksi Kulit Bakterial Dalam)",
        "category": "Dermatologi & Alergi",
        "symptoms": "Area kulit tampak kemerahan yang melebar cepat, bengkak, teraba hangat dan sangat nyeri saat disentuh, disertai demam, menggigil, dan pembengkakan kelenjar getah bening di sekitarnya.",
        "description": "Infeksi bakteri serius pada lapisan kulit dalam dan jaringan subkutan (sering disebabkan bakteri Streptococcus atau Staphylococcus) yang masuk melalui luka gores, gigitan serangga, atau kulit pecah-pecah.",
        "precaution": "Segera periksa ke dokter untuk mendapatkan antibiotik oral atau intravena agar infeksi tidak masuk ke aliran darah. Tandai batas kemerahan kulit untuk memantau penyebaran dan segera ke IGD jika demam tinggi.",
        "urgency_level": "Darurat",
    },
    "MED-119": {
        "disease_name": "Gangguan Obsesif-Kompulsif (OCD)",
        "category": "Kesehatan Mental & Psikosomatis",
        "symptoms": "Pikiran atau dorongan berulang yang tidak diinginkan dan memicu kecemasan hebat (obsesi), diikuti perilaku berulang yang terasa harus dilakukan untuk meredakan cemas (kompulsi) seperti mencuci tangan atau memeriksa kunci berkali-kali.",
        "description": "Gangguan kesehatan mental kronis ketika seseorang terjebak dalam siklus obsesi dan kompulsi yang sulit dikendalikan hingga menyita waktu serta mengganggu aktivitas harian.",
        "precaution": "Konsultasikan dengan psikolog klinis atau psikiater untuk terapi perilaku kognitif (CBT / ERP) dan pengobatan yang sesuai, serta libatkan dukungan keluarga.",
        "urgency_level": "Sedang",
    },
    "MED-121": {
        "disease_name": "Penyakit Hati & Kolestasis (Liver Diseases)",
        "category": "Sistem Pencernaan",
        "symptoms": "Kulit dan mata menguning (ikterus), rasa gatal di seluruh kulit, urine berwarna gelap, tinja tampak pucat, perut terasa penuh atau membengkak, mual, dan mudah lelah.",
        "description": "Berbagai gangguan pada organ hati termasuk gangguan aliran empedu (kolestasis), perlemakan hati, maupun peradangan hati yang mengganggu fungsi metabolisme dan detoksifikasi tubuh.",
        "precaution": "Hindari konsumsi alkohol dan obat-obatan herbal tanpa pengawasan medis, batasi makanan berlemak tinggi, serta lakukan pemeriksaan laboratorium fungsi hati secara rutin ke dokter.",
        "urgency_level": "Sedang",
    },
    "MED-127": {
        "disease_name": "Hepatitis Virus Akut & Kronis (Hepatitis)",
        "category": "Sistem Pencernaan",
        "symptoms": "Kelelahan berat, demam ringan, kehilangan nafsu makan, mual, muntah, nyeri perut bagian kanan atas, urine berwarna gelap, tinja pucat, serta kulit dan mata menguning.",
        "description": "Peradangan pada jaringan hati yang paling sering disebabkan oleh infeksi virus hepatitis (A, B, C, D, maupun E) yang menular melalui makanan/air terkontaminasi atau cairan tubuh/darah.",
        "precaution": "Istirahat cukup, hindari alkohol dan obat yang membebani hati, lengkapi vaksinasi Hepatitis A dan B, serta konsultasikan ke dokter untuk tes serologi virus dan pemantauan fungsi hati.",
        "urgency_level": "Sedang",
    },
    "MED-128": {
        "disease_name": "Penyakit Crohn (Crohn's Disease)",
        "category": "Sistem Pencernaan",
        "symptoms": "Diare kronis berkepanjangan, nyeri dan kram perut berulang, penurunan berat badan, kelelahan, demam ringan, serta kadang tinja bercampur darah atau sariawan berulang.",
        "description": "Penyakit radang usus kronis (inflammatory bowel disease) yang menyebabkan peradangan mendalam pada lapisan saluran pencernaan, paling sering mengenai usus halus dan usus besar.",
        "precaution": "Catat makanan pemicu kambuh, makan dalam porsi kecil bergizi seimbang, hentikan kebiasaan merokok, dan jalani kontrol rutin dengan dokter gastroenterologi untuk terapi antiinflamasi.",
        "urgency_level": "Sedang",
    },
    "MED-130": {
        "disease_name": "Selesma / Pilek Biasa (Common Cold)",
        "category": "Sistem Pernapasan",
        "symptoms": "Bersin-bersin, hidung tersumbat atau berair meler, sakit tenggorokan ringan, batuk, sakit kepala ringan, dan badan sedikit lelah; umumnya tidak disertai demam tinggi seperti influenza.",
        "description": "Infeksi virus ringan pada saluran pernapasan bagian atas (hidung dan tenggorokan) yang paling sering disebabkan oleh rhinovirus dan menular melalui udara atau sentuhan permukaan terkontaminasi.",
        "precaution": "Perbanyak istirahat, minum banyak cairan hangat, gunakan pelembab udara bersih, berkumur air garam untuk tenggorokan, serta cuci tangan rutin untuk mencegah penularan.",
        "urgency_level": "Ringan",
    },
    "MED-134": {
        "disease_name": "Kolera (Cholera)",
        "category": "Infeksi Tropis & Virus",
        "symptoms": "Diare cair sangat banyak secara mendadak (seperti air cucian beras), muntah hebat, kram otot tungkai, rasa haus ekstrem, mata cekung, dan tanda dehidrasi berat hingga syok.",
        "description": "Infeksi usus akut akibat bakteri Vibrio cholerae yang menyebar melalui air minum atau makanan yang terkontaminasi sanitasi buruk. Kehilangan cairan cepat dapat mengancam nyawa dalam hitungan jam.",
        "precaution": "Berikan cairan rehidrasi oral (oralit) segera dan bawa ke IGD atau puskesmas secepatnya untuk terapi cairan infus dan antibiotik yang tepat.",
        "urgency_level": "Darurat",
    },
    "MED-135": {
        "disease_name": "Emboli Paru (Pulmonary Embolism)",
        "category": "Sistem Pernapasan",
        "symptoms": "Sesak napas mendadak, nyeri dada tajam yang memburuk saat menarik napas dalam atau batuk, detak jantung sangat cepat, pusing atau pingsan mendadak, serta batuk yang dapat disertai darah.",
        "description": "Penyumbatan mendadak pada arteri pembuluh darah paru-paru, umumnya akibat gumpalan darah dari trombosis vena dalam (DVT) di tungkai yang lepas dan terbawa aliran darah menuju paru.",
        "precaution": "Kondisi gawat darurat medis yang mengancam nyawa. Segera hubungi layanan darurat 119 atau menuju IGD rumah sakit terdekat bila timbul sesak napas mendadak dan nyeri dada.",
        "urgency_level": "Darurat",
    },
}

# Clean up Indonesian disease_name labels for general MedlinePlus topics so link text matches destination
NAME_CLEANUPS: dict[str, str] = {
    "MED-029": "Hipertensi / Tekanan Darah Tinggi (High Blood Pressure)",
    "MED-034": "Hipotensi / Tekanan Darah Rendah (Low Blood Pressure)",
    "MED-049": "Dispepsia / Gangguan Pencernaan (Indigestion)",
    "MED-053": "Sakit Kepala Tegang & Nyeri Kepala (Headache)",
    "MED-086": "Infeksi Saluran Kemih / ISK (Urinary Tract Infections)",
    "MED-093": "Rhinitis Alergi / Hay Fever",
    "MED-107": "Diare Akut & Disentri (Diarrhea)",
    "MED-122": "Reaksi Alergi Obat (Drug Reactions)",
    "MED-129": "Perlemakan Hati & Radang Hati Steatotik (Steatotic Liver Disease)",
}


def clean_html(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", cleaned).strip()


def build_corpus(xml_path: Path, existing_json_path: Path, out_json_path: Path) -> None:
    tree = ET.parse(xml_path)
    root = tree.getroot()
    snapshot_raw = root.attrib.get("date-generated", "11/26/2026")
    # Convert MM/DD/YYYY HH:MM:SS -> YYYY-MM-DD
    date_part = snapshot_raw.split(" ")[0]
    parts = date_part.split("/")
    snapshot_iso = f"{parts[2]}-{parts[0].zfill(2)}-{parts[1].zfill(2)}" if len(parts) == 3 else "2026-11-26"

    en_topics = {
        t.attrib["id"]: t
        for t in root.findall("health-topic")
        if t.attrib.get("language") == "English"
    }

    existing_list = json.loads(existing_json_path.read_text(encoding="utf-8"))
    existing_map = {d["doc_id"]: d for d in existing_list}

    final_docs: list[dict] = []
    seen_topic_ids: set[str] = set()

    for doc_id in sorted(MEDLINEPLUS_MAPPING.keys()):
        topic_id = MEDLINEPLUS_MAPPING[doc_id]
        if topic_id in seen_topic_ids:
            raise ValueError(f"Duplicate MedlinePlus topic_id {topic_id} on {doc_id}")
        seen_topic_ids.add(topic_id)

        topic_el = en_topics.get(topic_id)
        if topic_el is None:
            raise KeyError(f"MedlinePlus topic_id {topic_id} not found in XML")

        base = dict(existing_map.get(doc_id, {}))
        if doc_id in OVERRIDES:
            base.update(OVERRIDES[doc_id])
        if doc_id in NAME_CLEANUPS:
            base["disease_name"] = NAME_CLEANUPS[doc_id]

        title_en = topic_el.attrib["title"]
        url = topic_el.attrib["url"]
        fs_el = topic_el.find("full-summary")
        raw_summary = clean_html("".join(fs_el.itertext())) if fs_el is not None else topic_el.attrib.get("meta-desc", "")
        excerpt = raw_summary[:290].rsplit(" ", 1)[0] + "..." if len(raw_summary) > 290 else raw_summary

        # Verify URL is valid https://medlineplus.gov/...
        if not url.startswith("https://medlineplus.gov/"):
            raise ValueError(f"Unexpected URL for {doc_id}: {url}")

        final_docs.append({
            "doc_id": doc_id,
            "disease_name": base["disease_name"],
            "category": base["category"],
            "symptoms": base["symptoms"],
            "description": base["description"],
            "precaution": base["precaution"],
            "urgency_level": base["urgency_level"],
            "source": f"MedlinePlus (NIH/NLM) — {title_en}",
            "source_id": f"MedlinePlus #{topic_id}",
            "source_title": title_en,
            "source_url": url,
            "source_excerpt": excerpt,
            "source_snapshot": snapshot_iso,
        })

    out_json_path.write_text(json.dumps(final_docs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(final_docs)} verified MedlinePlus documents -> {out_json_path}")
    print(f"Unique MedlinePlus topic IDs: {len(seen_topic_ids)}")
    print(f"Unique source URLs: {len(set(d['source_url'] for d in final_docs))}")
    print(f"Snapshot date: {snapshot_iso}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--xml", required=True, help="Path to MedlinePlus mplus_topics_*.xml file")
    parser.add_argument("--existing", default="src/data/medical_dataset.json")
    parser.add_argument("--out", default="src/data/medical_dataset.json")
    args = parser.parse_args()
    build_corpus(Path(args.xml), Path(args.existing), Path(args.out))
