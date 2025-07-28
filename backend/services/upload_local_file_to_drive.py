import os
from googleapiclient.http import MediaFileUpload

def upload_local_file_to_drive(filepath: str, service, parent_id: str):
    """
    Upload a file from the local system into a specified folder (OHacksMirror or its subfolder) in Google Drive.

    Args:
        filepath (str): Full path to the local file you want to upload.
        service: Google Drive API service instance.
        parent_id (str): The folder ID where the file will be uploaded (OHacksMirror or chosen subfolder).

    Returns:
        str: Upload confirmation message with file details.
    """

    # Validate file exists
    if not os.path.exists(filepath):
        return f"❌ The file '{filepath}' does not exist."

    # Prepare metadata for Google Drive
    file_name = os.path.basename(filepath)
    file_metadata = {"name": file_name, "parents": [parent_id]}
    media = MediaFileUpload(filepath, resumable=True)

    # Upload file
    uploaded_file = service.files().create(
        body=file_metadata,
        media_body=media,
        fields="id, name, parents, webViewLink"
    ).execute()

    return f"✅ Uploaded '{file_name}' to Google Drive (Folder ID: {parent_id}). Link: {uploaded_file['webViewLink']}"