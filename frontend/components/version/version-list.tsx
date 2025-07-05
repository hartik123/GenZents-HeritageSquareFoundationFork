"use client"

import { memo } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Version } from "@/lib/types/version"
import { filterVersions } from "@/lib/utils/version"
import { VersionCard } from "./version-card"
import { EmptyVersionState } from "./empty-version-state"

interface VersionListProps {
  versions: Version[]
  searchQuery: string
  onSearchChange: (query: string) => void
  onRollback: (versionId: string) => void
  loading?: boolean
  className?: string
}

export const VersionList = memo<VersionListProps>(function VersionList({
  versions,
  searchQuery,
  onSearchChange,
  onRollback,
  loading = false,
  className = "",
}) {
  const filteredVersions = filterVersions(versions, searchQuery, "")

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-muted-foreground">Loading versions...</div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search versions..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredVersions.length > 0 ? (
            filteredVersions.map((version) => (
              <VersionCard key={version.id} version={version} onRollback={onRollback} />
            ))
          ) : searchQuery ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No versions match your search</p>
            </div>
          ) : (
            <EmptyVersionState />
          )}
        </div>
      </ScrollArea>
    </div>
  )
})
