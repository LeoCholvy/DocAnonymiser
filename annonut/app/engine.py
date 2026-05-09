import fitz
import yaml
import re
from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_analyzer.nlp_engine import NlpEngineProvider
from docx import Document

with open("config.yaml", "r") as f:
    config = yaml.safe_load(f)

# Singleton pour éviter de recharger le modèle lourd à chaque fichier
_analyzer = None

def get_analyzer():
    global _analyzer
    if _analyzer is None:
        print("Chargement du moteur IA (Spacy LG + Camembert)...")
        configuration = {
            "nlp_engine_name": "transformers",
            "models": [{
                "lang_code": "fr",
                "model_name": {
                    "spacy": config["nlp"]["spacy_model"],
                    "transformers": config["nlp"]["transformers_model"]
                }
            }]
        }
        provider = NlpEngineProvider(nlp_configuration=configuration)
        _analyzer = AnalyzerEngine(nlp_engine=provider.create_engine(), supported_languages=["fr"])

        # # Règle : Tour de Table
        # regex_speaker = Pattern(name="regex_speaker", regex=r"\b[A-Z][a-zÀ-ÿ]+\b(?=\s*:)", score=0.9)
        # speaker_recognizer = PatternRecognizer(supported_entity="SPEAKER", patterns=[regex_speaker])
        # _analyzer.registry.add_recognizer(speaker_recognizer)
    return _analyzer

def process_pdf(input_path: str, output_path: str, whitelist: list, entities_to_mask: list):
    analyzer = get_analyzer()
    doc = fitz.open(input_path)
    mots_masques_total = 0

    whitelist_lower = [w.lower() for w in whitelist]

    for page in doc:
        texte_page = page.get_text()
        if not texte_page.strip(): continue

        resultats = analyzer.analyze(text=texte_page, entities=entities_to_mask, language="fr")
        mots_a_censurer = set()

        for resultat in resultats:
            mot_exact = texte_page[resultat.start:resultat.end].strip()
            mot_nettoye = mot_exact.lower()

            if mot_nettoye not in whitelist_lower and len(mot_nettoye) > 2:
                mots_a_censurer.add(mot_exact)

        for mot in mots_a_censurer:
            mot_propre = mot.replace('\n', ' ').strip()
            if not mot_propre: continue

            zones_texte = page.search_for(mot_propre, quads=True)

            if not zones_texte and " " in mot_propre:
                for sous_mot in mot_propre.split():
                    if len(sous_mot) > 3:
                        for zone in page.search_for(sous_mot, quads=True):
                            page.add_redact_annot(zone, fill=(0, 0, 0))
                            mots_masques_total += 1
                continue

            for zone in zones_texte:
                page.add_redact_annot(zone, fill=(0, 0, 0))
                mots_masques_total += 1

        page.apply_redactions()

    doc.save(output_path, garbage=4, deflate=True)
    return mots_masques_total

def process_docx(input_path: str, output_path: str, whitelist: list, entities_to_mask: list):
    analyzer = get_analyzer()
    doc = Document(input_path)
    mots_masques_total = 0
    whitelist_lower = [w.lower() for w in whitelist]

    # Fonction récursive pour traiter n'importe quel bloc de texte
    def traiter_texte(texte):
        nonlocal mots_masques_total
        if not texte.strip(): return texte

        resultats = analyzer.analyze(text=texte, entities=entities_to_mask, language="fr")

        # On trie en ordre inverse ! Très important pour remplacer du texte
        # sans décaler les index des mots suivants.
        resultats = sorted(resultats, key=lambda x: x.start, reverse=True)

        texte_modifie = texte
        for res in resultats:
            mot_exact = texte[res.start:res.end]
            if mot_exact.lower() not in whitelist_lower and len(mot_exact) > 2:
                # On remplace par le type d'entité (ex: Jean -> [PERSON])
                remplacement = f"[{res.entity_type}]"
                texte_modifie = texte_modifie[:res.start] + remplacement + texte_modifie[res.end:]
                mots_masques_total += 1

        return texte_modifie

    # 1. Traitement des paragraphes normaux
    for para in doc.paragraphs:
        if para.text:
            para.text = traiter_texte(para.text)

    # 2. Traitement des textes dans les tableaux (très courant dans les bilans financiers)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    if para.text:
                        para.text = traiter_texte(para.text)

    doc.save(output_path)
    return mots_masques_total

def process_text(input_path: str, output_path: str, whitelist: list, entities_to_mask: list):
    analyzer = get_analyzer()
    mots_masques_total = 0
    whitelist_lower = [w.lower() for w in whitelist]

    # Lecture du fichier brut
    with open(input_path, 'r', encoding='utf-8') as f:
        texte = f.read()

    if not texte.strip():
        # Si le fichier est vide, on le copie tel quel
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(texte)
        return 0

    # Analyse par l'IA
    resultats = analyzer.analyze(text=texte, entities=entities_to_mask, language="fr")

    # Tri inversé pour ne pas casser les index lors du remplacement
    resultats = sorted(resultats, key=lambda x: x.start, reverse=True)

    texte_modifie = texte
    for res in resultats:
        mot_exact = texte[res.start:res.end]
        if mot_exact.lower() not in whitelist_lower and len(mot_exact) > 2:
            remplacement = f"[{res.entity_type}]"
            texte_modifie = texte_modifie[:res.start] + remplacement + texte_modifie[res.end:]
            mots_masques_total += 1

    # Écriture du nouveau fichier
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(texte_modifie)

    return mots_masques_total