import os
import io
import json
import PyPDF2


# --- Google Drive Utilities ---
def download_pdf_text(drive_service, file_id):
    file_bytes = drive_service.download_file(file_id)
    fh = io.BytesIO(file_bytes)
    reader = PyPDF2.PdfReader(fh)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text
