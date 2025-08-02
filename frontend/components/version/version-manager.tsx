"use client"

import { useEffect, useState } from "react"
import { Search, Plus, History } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { filterVersions } from "@/lib/utils/version"
import { useVersionStore } from "@/lib/stores/version-store"
import { Version } from "@/lib/types/version"
import { VersionCard } from "./version-card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { VersionDetails } from "./version-details"
import { useToast } from "@/hooks/use-toast"

interface VersionManagerProps {
  versions: Version[]
}

export function VersionManager({ versions }: VersionManagerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const [allVersions, setAllVersions] = useState<Version[]>(versions ?? [])
  const [loading, setLoading] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState<Version | null>(null)
  const [isRollingBack, setIsRollingBack] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    setAllVersions(versions ?? [])
  }, [versions])

  // Sort by most recent (created_at desc)
  const sortedVersions = [...allVersions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const filteredVersions = filterVersions(sortedVersions, searchQuery, "")

  const handleRequestRollback = (versionId: string) => {
    const version = allVersions.find((v) => v.id === versionId)
    if (version) setRollbackTarget(version)
  }

  const handleConfirmRollback = async () => {
    toast({title: "Upcoming feature"})
    // if (!rollbackTarget) return
    // setIsRollingBack(true)
    // setAllVersions((prev) => {
    //   const idx = prev.findIndex((v) => v.id === rollbackTarget.id)
    //   if (idx === -1) return prev
    //   return prev.slice(0, idx + 1)
    // })
    setSelectedVersion(null)
    setIsRollingBack(false)
    setRollbackTarget(null)
  }

  const handleCreateVersion = () => {
    // Add a new mock version
    const nextVersionNum = allVersions.length + 1
    const newVersion: Version = {
      id: String(Date.now()),
      version: `1.0.${nextVersionNum}`,
      title: `Mock Version ${nextVersionNum}`,
      description: `This is a mock version ${nextVersionNum}.`,
      user_id: "mockuser",
      timestamp: new Date(),
      created_at: new Date().toISOString(),
      data: {},
    }
    setAllVersions((prev) => [newVersion, ...prev])
  }

  const handleViewDetails = (version: Version) => {
    setSelectedVersion(version)
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
        <VersionDetails
          version={selectedVersion}
          isCurrent={selectedVersion.id === allVersions[0].id}
          onRollback={() => handleRequestRollback(selectedVersion.id)}
          onBack={() => setSelectedVersion(null)}
        />
      </div>
    )
  }

  function renderVersions(copyOfVersions: Version[]) {
    console.log(copyOfVersions)
    console.log(versions)
    if (copyOfVersions.length === 0) return (
      <div className="flex flex-col items-center">
        <History className="h-16 w-16 mx-auto text-muted-foreground/50" />
        <div className="space-y-2 text-center">
          <h3 className="text-lg font-semibold">No Versions Found</h3>
          <p className="text-muted-foreground text-sm">
            No versions have been created yet. Create your first version to track changes and enable rollback functionality.
          </p>
        </div>
      </div>
    )

    return (
      <ul className="space-y-4">
        {copyOfVersions.map((v) => (
          <li key={v.id} className="border p-4 rounded shadow-sm">
            <h3 className="font-semibold text-lg">{v.title || "Untitled Version"}</h3>
            <p className="text-sm text-muted-foreground mb-1">{v.description || "No description"}</p>
            <p className="text-xs text-gray-500">
              Version: {v.version} | User: {v.user_id} |{" "}
              {new Date(v.timestamp || v.created_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
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
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredVersions.length > 0 ? (
            filteredVersions.map((version) => (
              <VersionCard
                key={version.id}
                version={version}
                onRollback={() => handleRequestRollback(version.id)}
                onViewDetails={handleViewDetails}
              />
            ))
          ) : searchQuery ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No versions match your search criteria</p>
              <Button variant="ghost" onClick={() => setSearchQuery("")} className="mt-2">
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-4 max-w-md">
                {renderVersions(allVersions)}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      {/* Rollback Confirmation Dialog */}
      <Dialog
        open={!!rollbackTarget}
        onOpenChange={(open) => {
          if (!open) setRollbackTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
            <DialogDescription>
              {rollbackTarget && (
                <>
                  Are you sure you want to rollback to version v{rollbackTarget.version}? This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackTarget(null)} disabled={isRollingBack}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmRollback} disabled={isRollingBack}>
              {isRollingBack ? "Rolling back..." : "Confirm Rollback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
