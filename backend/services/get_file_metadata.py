from backend.scripts.scan_and_embed_drive import query_drive_metadata

def get_file_metadata(service, folder_id=None, name_filter=None):
    """
    Standalone tool to fetch metadata for files in Drive.

    Args:
        service: Google Drive API service (authenticated).
        folder_id: Optional folder ID to narrow results (defaults to all).
        name_filter: Optional string to filter by file name (case-insensitive).

    Returns:
        str: A formatted list of files with their metadata.
    """
    # Pull all indexed metadata from Chroma
    results = query_drive_metadata()
    filtered = results

    # Apply optional filters
    if folder_id:
        filtered = [f for f in results if f['parent_folder'] == folder_id]
    if name_filter:
        filtered = [f for f in filtered if name_filter.lower() in f['file_name'].lower()]

    # Handle empty results
    if not filtered:
        return f"❌ No files found matching '{name_filter or 'all'}'."

    # Build report
    report_lines = []
    for meta in filtered:
        folder_name = service.files().get(
            fileId=meta['parent_folder'],
            fields="name"
        ).execute().get('name', 'Unknown')
        report_lines.append(
            f"📄 {meta['file_name']} | Folder: {folder_name} | Size: {meta['size_mb']} MB | Modified: {meta['modified_time']}"
        )

    return "\n".join(report_lines)