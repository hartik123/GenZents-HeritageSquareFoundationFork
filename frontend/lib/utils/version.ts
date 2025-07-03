import { ChangeType, VersionStatus, Version } from "../types/version"

export const getChangeTypeColor = (type: ChangeType) => {
  switch (type) {
    case "added":
      return "bg-green-100 text-green-800"
    case "modified":
      return "bg-blue-100 text-blue-800"
    case "deleted":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export const getStatusColor = (status: VersionStatus) => {
  switch (status) {
    case "current":
      return "bg-green-100 text-green-800"
    case "previous":
      return "bg-blue-100 text-blue-800"
    case "archived":
      return "bg-gray-100 text-gray-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export const filterVersions = (versions: Version[], searchQuery: string, filterBranch: string) => {
  return versions.filter((version) => {
    const matchesSearch =
      version.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      version.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      version.user_id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })
}

export const exportVersion = (version: Version) => {
  const exportData = {
    version: version.version,
    title: version.title,
    description: version.description,
    user_id: version.user_id,
    timestamp: version.timestamp,
    status: version.status,
    changes: version.data?.changes || [],
    created_at: version.created_at,
    data: version.data || {},
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `version-${version.version}.json`
  a.click()
  URL.revokeObjectURL(url)
}
