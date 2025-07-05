"use client"

import { useEffect, useState } from "react"
import { useVersionStore } from "@/lib/stores/version-store"
import { VersionList } from "./version-list"

interface VersionHistoryProps {
  chatId: string
  className?: string
}

export function VersionHistory({ chatId, className }: VersionHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const { versions, loading, loadVersions, rollbackToVersion } = useVersionStore()

  useEffect(() => {
    if (chatId) {
      loadVersions(chatId)
    }
  }, [chatId, loadVersions])

  const handleRollback = async (versionId: string) => {
    try {
      await rollbackToVersion(versionId)
      await loadVersions(chatId)
    } catch (error) {
      console.error("Failed to rollback version:", error)
    }
  }

  return (
    <VersionList
      versions={versions}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onRollback={handleRollback}
      loading={loading}
      className={className}
    />
  )
}
