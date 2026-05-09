import fitz
import json
import re
from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_analyzer.nlp_engine import NlpEngineProvider

# --- 1. CHARGEMENT DU DICTIONNAIRE EXTERNE ---
print("1. Chargement du dictionnaire asso...")
with open("dictionnaire_asso.json", "r", encoding="utf-8") as f:
    config_asso = json.load(f)

# On passe la liste blanche en minuscules pour faciliter les comparaisons
MOTS_A_PROTEGER = [m.lower() for m in config_asso["mots_a_proteger"]]
SURNOMS = config_asso["surnoms_a_censurer"]

# --- 2. CONFIGURATION DE L'IA ---
print("2. Chargement du moteur NLP...")
configuration = {"nlp_engine_name": "spacy", "models": [{"lang_code": "fr", "model_name": "fr_core_news_lg"}]}
provider = NlpEngineProvider(nlp_configuration=configuration)
analyzer = AnalyzerEngine(nlp_engine=provider.create_engine(), supported_languages=["fr"])

# --- 3. AJOUT DES RÈGLES SUR-MESURE (PRESIDIO REGISTRY) ---

# Règle A : L'artillerie lourde pour les surnoms (Regex dynamique)
# On transforme ["Flo", "Val"] en regex : \b(Flo|Val)\b (Insensible à la casse)
surnoms_regex = r"(?i)\b(" + "|".join(SURNOMS) + r")\b"
surnom_recognizer = PatternRecognizer(
    supported_entity="SURNOM",
    patterns=[Pattern(name="surnoms_match", regex=surnoms_regex, score=1.0)]
)
analyzer.registry.add_recognizer(surnom_recognizer)

# Règle B : La Regex "Tour de table" assouplie
# On cherche N'IMPORTE QUEL mot commençant par une majuscule, directement suivi d'un ":"
regex_speaker = Pattern(name="regex_speaker", regex=r"\b([A-Z][a-zÀ-ÿ]+)\s*:", score=0.9)
speaker_recognizer = PatternRecognizer(supported_entity="SPEAKER", patterns=[regex_speaker])
analyzer.registry.add_recognizer(speaker_recognizer)

ENTITES_A_CHERCHER = ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "SURNOM", "SPEAKER"]

# --- 4. TRAITEMENT DU PDF ---
FICHIER_ENTREE = "test.pdf" # Mets ici ton PDF avec l'ODJ et le REx
FICHIER_SORTIE = "test_anonymise.pdf"

print(f"3. Ouverture de {FICHIER_ENTREE}...")
doc = fitz.open(FICHIER_ENTREE)
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

        # FILTRE MAGIQUE : On censure SI le mot n'est pas dans la liste blanche
        # Et on évite de censurer des lettres seules (len > 2) sauf si c'est un diminutif connu (Jb, Jc)
        if mot_nettoye not in MOTS_A_PROTEGER and (len(mot_nettoye) > 2 or mot_exact in SURNOMS):
            mots_a_censurer.add(mot_exact)

    # Application visuelle
    for mot in mots_a_censurer:
        # On supprime tout ce qui n'est pas une lettre pour la recherche visuelle
        mot_propre_pour_pdf = re.sub(r'[^\wÀ-ÿ-]', '', mot)

        # On cherche le mot nettoyé
        zones_texte = page.search_for(mot_propre_pour_pdf)

        for zone in zones_texte:
            page.add_redact_annot(zone, fill=(0, 0, 0))
            mots_masques_total += 1

    page.apply_redactions()

doc.save(FICHIER_SORTIE, garbage=4, deflate=True)
print(f"✅ Terminé ! {mots_masques_total} zones ont été censurées dans {FICHIER_SORTIE}.")