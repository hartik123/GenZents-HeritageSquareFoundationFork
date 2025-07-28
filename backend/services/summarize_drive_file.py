import re
import os
from io import BytesIO
from googleapiclient.http import MediaIoBaseDownload
from PyPDF2 import PdfReader

# def handle_summarize_request(query: str, service) -> str:
#     """
#     Natural language handler to summarize a PDF file from Drive.

#     Args:
#         query (str): User's natural language request
#         service: Google Drive API service

#     Returns:
#         str: Summary or error message
#     """
#     # Try to extract file name ending in .pdf from query
#     match = re.search(r'([\w\- ]+\.pdf)', query, re.IGNORECASE)
#     if not match:
#         return "❌ I couldn't find a PDF file name in your request."

#     file_name = match.group(1).strip()

#     try:
#         # Look up file in Drive
#         results = service.files().list(
#             q=f"name='{file_name}' and trashed=false",
#             fields="files(id, name)"
#         ).execute()

#         files = results.get("files", [])
#         if not files:
#             return f"❌ File '{file_name}' not found in Drive."

#         file_id = files[0]['id']
#         return handle_summarize_request(service, file_id)

#     except Exception as e:
#         return f"❌ Something went wrong: {e}"


def handle_summarize_request(file_query, service):
    """
    Summarizes a PDF by resolving the file (name, path, or ID) to a valid fileId first.
    """

    # Step 1: Try to treat query as a file ID directly
    if isinstance(file_query, str) and len(file_query) > 20 and "/" not in file_query:
        file_id = file_query
    else:
        # Step 2: Search by name or path to get the fileId
        name = file_query.split("/")[-1] if "/" in file_query else file_query
        query = f"name='{name}' and mimeType='application/pdf' and trashed=false"
        result = service.files().list(q=query, fields="files(id, name)").execute()
        files = result.get("files", [])
        if not files:
            return f"❌ Could not find PDF file '{file_query}'."
        file_id = files[0]["id"]

    # Step 3: Download the PDF using the file ID
    try:
        request = service.files().get_media(fileId=file_id)
        from io import BytesIO
        from googleapiclient.http import MediaIoBaseDownload
        fh = BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()

        fh.seek(0)
        from PyPDF2 import PdfReader
        reader = PdfReader(fh)
        text = "".join([page.extract_text() or "" for page in reader.pages])

        return f"📄 Summary of '{file_query}':\n\n{text[:1500]}..."  # limit for display

    except Exception as e:
        return f"❌ Failed to summarize '{file_query}': {e}"