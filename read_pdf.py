import sys
from pypdf import PdfReader

reader = PdfReader('DocAnonymiser.pdf')
text = '\n'.join([page.extract_text() for page in reader.pages])
with open('pdf_text.txt', 'w', encoding='utf-8') as f:
    f.write(text)
