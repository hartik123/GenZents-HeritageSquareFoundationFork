from google.oauth2 import service_account
from googleapiclient.discovery import build
import os

SERVICE_ACCOUNT_FILE = os.path.join(os.path.dirname(__file__), 'service_account_key.json')
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

def main():
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build('drive', 'v3', credentials=creds)

    print("Fetching files using service account...")
    results = service.files().list(
        pageSize=10,
        fields="files(id, name, mimeType)"
    ).execute()

    files = results.get('files', [])
    if not files:
        print("No files found.")
    else:
        print("Files:")
        for file in files:
            print(f"- {file['name']} (ID: {file['id']})")

if __name__ == "__main__":
    main()
