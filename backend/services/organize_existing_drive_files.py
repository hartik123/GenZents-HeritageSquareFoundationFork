def organize_existing_drive_files(service, root_folder_id, folder_map=None, apply_changes=False):
    from collections import defaultdict
    import os
    summary = defaultdict(list)
    name_tracker = defaultdict(int)

    def list_all_items(folder_id):
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, mimeType, parents)"
        ).execute()
        items = results.get("files", [])
        all_items = []
        for item in items:
            if item["mimeType"] == "application/vnd.google-apps.folder":
                all_items.extend(list_all_items(item["id"]))
            else:
                all_items.append(item)
        return all_items

    def suggest_category(item):
        mime = item.get("mimeType", "")
        name = item["name"].lower()
        if "pdf" in mime or name.endswith(".pdf"):
            return "Documents/PDFs"
        elif "spreadsheet" in mime or name.endswith((".xls", ".xlsx", ".csv")):
            return "Documents/Spreadsheets"
        elif "presentation" in mime or name.endswith((".ppt", ".pptx")):
            return "Documents/Presentations"
        elif "image" in mime:
            return "Media/Images"
        elif "video" in mime:
            return "Media/Videos"
        elif "audio" in mime:
            return "Media/Audio"
        else:
            return "Miscellaneous"

    def rename_if_duplicate(filename):
        name, ext = os.path.splitext(filename)
        name_tracker[filename] += 1
        if name_tracker[filename] > 1:
            return f"{name}({name_tracker[filename]}){ext}"
        return filename

    all_items = list_all_items(root_folder_id)
    if not all_items:
        print("ℹ️ No files found to organize.")
        return {"status": "empty", "structure": {}}

    # Check upfront if everything is already organized
    already_organized = True
    for item in all_items:
        expected_category = suggest_category(item)
        parents = item.get("parents", [])
        if not any(expected_category.split("/")[-1].lower() in p.lower() for p in parents):
            already_organized = False
        clean_name = rename_if_duplicate(item["name"])
        summary[expected_category].append(clean_name)

    if already_organized:
        print("\n✅ Your Drive is already organized. No changes needed.")
        return {"status": "organized", "structure": summary}

    # Only show preview and ask if not organized
    print("\n📂 Proposed Folder Structure (Preview):")
    for category, files in summary.items():
        print(f"- {category}: {len(files)} file(s)")

    confirm = input("\nApply this organization plan? (y/n): ").strip().lower()
    if confirm != "y":
        print("\n❌ No changes were made.")
        return {"status": "preview", "structure": summary}

    # Apply moves
    for category, files in summary.items():
        folder_parts = category.split("/")
        parent_id = root_folder_id
        for part in folder_parts:
            results = service.files().list(
                q=f"mimeType='application/vnd.google-apps.folder' and name='{part}' and '{parent_id}' in parents and trashed=false",
                fields="files(id, name)"
            ).execute()
            folders = results.get("files", [])
            if folders:
                folder_id = folders[0]['id']
            else:
                folder = service.files().create(
                    body={"name": part, "mimeType": "application/vnd.google-apps.folder", "parents": [parent_id]},
                    fields="id, name"
                ).execute()
                folder_id = folder['id']
            parent_id = folder_id

        for file_name in files:
            results = service.files().list(
                q=f"name='{file_name}' and trashed=false",
                fields="files(id, parents)"
            ).execute()
            matched_files = results.get("files", [])
            if matched_files:
                file_id = matched_files[0]['id']
                old_parents = ",".join(matched_files[0].get("parents", []))
                service.files().update(
                    fileId=file_id,
                    addParents=parent_id,
                    removeParents=old_parents,
                    fields="id, parents"
                ).execute()
                print(f"📦 Moved '{file_name}' → {category}")

    print("\n✅ Drive has been reorganized based on the proposed structure.")
    return {"status": "applied", "structure": summary}