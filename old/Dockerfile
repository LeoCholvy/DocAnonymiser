FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y build-essential

# 1. On met à jour pip pour qu'il soit plus intelligent face aux conflits
RUN pip install --upgrade pip

COPY requirements.txt .
# 2. On laisse pip faire son travail
RUN pip install --no-cache-dir -r requirements.txt

RUN python -m spacy download fr_core_news_md

CMD ["python", "niveau0_avance.py"]