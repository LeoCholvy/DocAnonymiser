import fitz
import json
import re
from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_analyzer.nlp_engine import NlpEngineProvider

# --- 1. CHARGEMENT DU DICTIONNAIRE EXTERNE ---
print("1. Chargement du dictionnaire asso...")
with open("dictionnaire_asso.json", "r", encoding="utf-8") as f:
    config_asso = json.load(f)

MOTS_A_PROTEGER = [m.lower() for m in config_asso["mots_a_proteger"]]
SURNOMS = config_asso["surnoms_a_censurer"]

# --- 2. CONFIGURATION DE L'IA (TRANSFORMERS / CAMEMBERT) ---
print("2. Chargement du super-moteur IA (Cela va prendre 1 ou 2 minutes la première fois)...")
configuration = {
    "nlp_engine_name": "transformers",
    "models": [
        {
            "lang_code": "fr",
            "model_name": {
                "spacy": "fr_core_news_md",
                "transformers": "Jean-Baptiste/camembert-ner" # Le champion français !
            }
        }
    ]
}

provider = NlpEngineProvider(nlp_configuration=configuration)
analyzer = AnalyzerEngine(nlp_engine=provider.create_engine(), supported_languages=["fr"])

# --- 3. FILET DE SÉCURITÉ (RÈGLES MANUELLES) ---
# Règle A : Les surnoms
surnoms_regex = r"(?i)\b(" + "|".join(SURNOMS) + r")\b"
surnom_recognizer = PatternRecognizer(
    supported_entity="SURNOM",
    patterns=[Pattern(name="surnoms_match", regex=surnoms_regex, score=1.0)]
)
analyzer.registry.add_recognizer(surnom_recognizer)

# Règle B : Le Tour de Table (Cherche un mot avec majuscule, suivi d'un deux-points)
regex_speaker = Pattern(name="regex_speaker", regex=r"\b[A-Z][a-zÀ-ÿ]+\b(?=\s*:)", score=0.9)
speaker_recognizer = PatternRecognizer(supported_entity="SPEAKER", patterns=[regex_speaker])
analyzer.registry.add_recognizer(speaker_recognizer)

ENTITES_A_CHERCHER = ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "SURNOM", "SPEAKER", "LOCATION", "CREDIT_CARD", "IBAN_CODE", "CRYPTO", "NRP", "MEDICAL_LICENSE"]

# --- 4. TRAITEMENT DU PDF ---
FICHIER_ENTREE = "test.pdf"
FICHIER_SORTIE = "test_anonymise.pdf"

print(f"3. Ouverture de {FICHIER_ENTREE}...")
try:
    doc = fitz.open(FICHIER_ENTREE)
except Exception as e:
    print(f"❌ Erreur : Impossible d'ouvrir {FICHIER_ENTREE}. Vérifie qu'il est dans le dossier.")
    exit()

mots_masques_total = 0

print("4. Analyse et Censure en cours...")
for page in doc:
    texte_page = page.get_text()
    if not texte_page.strip(): continue

    resultats = analyzer.analyze(text=texte_page, entities=ENTITES_A_CHERCHER, language="fr")
    mots_a_censurer = set()

    for resultat in resultats:
        mot_exact = texte_page[resultat.start:resultat.end].strip()
        mot_nettoye = mot_exact.lower()

        # Filtre Liste Blanche + Ignorer les lettres seules
        if mot_nettoye not in MOTS_A_PROTEGER and (len(mot_nettoye) > 2 or mot_exact in SURNOMS):
            mots_a_censurer.add(mot_exact)

    # Mode Debug : Voir ce que l'IA a décidé d'attaquer
    if mots_a_censurer:
        print(f"   -> Page {page.number + 1} : Cibles validées = {mots_a_censurer}")

    # Application visuelle
    for mot in mots_a_censurer:
        # On nettoie juste les sauts de ligne potentiels qui pourraient casser la recherche stricte
        # sans détruire les espaces, les '@' ou les '.'
        mot_propre = mot.replace('\n', ' ').strip()
        if not mot_propre: continue

        # L'utilisation de quads=True est beaucoup plus robuste pour surligner/censurer du texte
        zones_texte = page.search_for(mot_propre, quads=True)

        # Astuce de robustesse : Si le mot n'est pas trouvé d'un bloc (ex: coupé sur 2 lignes)
        # on essaie de le chercher morceau par morceau (uniquement si le morceau est assez long)
        if not zones_texte and " " in mot_propre:
            for sous_mot in mot_propre.split():
                if len(sous_mot) > 3: # On évite de censurer des mots trop courts comme "le", "de", "rue" partout
                    zones_secours = page.search_for(sous_mot, quads=True)
                    for zone in zones_secours:
                        page.add_redact_annot(zone, fill=(0, 0, 0))
                        mots_masques_total += 1
            continue # On passe au mot suivant

        # Censure normale si le mot entier est trouvé
        for zone in zones_texte:
            page.add_redact_annot(zone, fill=(0, 0, 0))
            mots_masques_total += 1

    page.apply_redactions()

doc.save(FICHIER_SORTIE, garbage=4, deflate=True)
print(f"\n✅ Terminé ! {mots_masques_total} zones ont été censurées dans {FICHIER_SORTIE}.")