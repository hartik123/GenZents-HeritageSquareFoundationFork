export interface Change {
  id: string
  version_id: string
  type: "added" | "modified" | "deleted"
  originalPath: string
  newPath?: string
  originalValue?: any
  newValue?: any
  description?: string
  command_id?: string
  user_id?: string
  timestamp: Date
}

export interface Version {
  id: string
  version: string
  title: string
  description: string
  user_id: string
  timestamp: Date
  status: "current" | "previous" | "archived"
  created_at: string
  data?: any
}

export type ChangeType = Change["type"]
export type VersionStatus = Version["status"]
