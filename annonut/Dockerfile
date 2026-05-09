FROM python:3.11-slim

# Dépendances système nécessaires
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Copie uniquement le fichier des dépendances d'abord
COPY requirements.txt .

# 2. LA LIGNE MAGIQUE : On active le cache persistant de pip
# Docker va sauvegarder les roues (.whl) téléchargées ici : /root/.cache/pip
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# 3. On utilise aussi le cache pour spacy (optionnel mais ça aide si tu changes de version)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install https://github.com/explosion/spacy-models/releases/download/fr_core_news_lg-3.7.0/fr_core_news_lg-3.7.0-py3-none-any.whl

# 4. Copie du code en dernier
COPY . .

# Création des dossiers de données
RUN mkdir -p /app/data/uploads /app/data/processed

ENV PYTHONPATH=/app