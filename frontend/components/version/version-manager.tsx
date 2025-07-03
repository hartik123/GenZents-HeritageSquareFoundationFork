"use client"

import { useEffect, useState } from "react"
import { Search, Plus, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useVersionStore } from "@/lib/stores/version-store"
import { filterVersions } from "@/lib/utils/version"
import { Version, VersionStatus } from "@/lib/types/version"
import { VersionCard } from "./version-card"
import { VersionDetails } from "./version-details"
import { EmptyVersionState } from "./empty-version-state"

interface VersionManagerProps {
  chatId: string
  onCreateVersion?: () => void
}

export function VersionManager({ chatId, onCreateVersion }: VersionManagerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<VersionStatus | "all">("all")
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const { versions, loading, loadVersions, rollbackToVersion, createVersion } = useVersionStore()

  const filteredVersions = versions.filter((version) => {
    const matchesSearch = filterVersions([version], searchQuery, "").length > 0
    const matchesStatus = statusFilter === "all" || version.status === statusFilter
    return matchesSearch && matchesStatus
  })

  useEffect(() => {
    if (chatId) {
      loadVersions(chatId)
    }
  }, [chatId, loadVersions])

  const handleRollback = async (versionId: string) => {
    try {
      await rollbackToVersion(versionId)
      await loadVersions(chatId)
      setSelectedVersion(null)
    } catch (error) {
      console.error("Failed to rollback version:", error)
    }
  }

  const handleCreateVersion = async () => {
    if (onCreateVersion) {
      onCreateVersion()
    } else {
      try {
        await createVersion(chatId, "New version")
        await loadVersions(chatId)
      } catch (error) {
        console.error("Failed to create version:", error)
      }
    }
  }

  const handleVersionSelect = (version: Version) => {
    setSelectedVersion(version)
  }

  const handleBackToList = () => {
    setSelectedVersion(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading versions...</div>
      </div>
    )
  }

  if (selectedVersion) {
    return (
      <div className="h-full p-4">
        <VersionDetails version={selectedVersion} onRollback={handleRollback} onBack={handleBackToList} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Version History</h2>
          <Button onClick={handleCreateVersion} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Version
          </Button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search versions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={(value: VersionStatus | "all") => setStatusFilter(value)}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="current">Current</SelectItem>
              <SelectItem value="previous">Previous</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredVersions.length > 0 ? (
            filteredVersions.map((version) => (
              <div key={version.id}>
                <VersionCard version={version} onRollback={handleRollback} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleVersionSelect(version)}
                  className="w-full mt-2 text-xs"
                >
                  View Details
                </Button>
              </div>
            ))
          ) : searchQuery || statusFilter !== "all" ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No versions match your search criteria</p>
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchQuery("")
                  setStatusFilter("all")
                }}
                className="mt-2"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <EmptyVersionState />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
