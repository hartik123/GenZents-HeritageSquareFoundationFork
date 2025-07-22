"use client"

import { VersionManager } from "@/components/version"

export default function VersionHistoryPage() {
  // For now, always show the mock version manager
  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Version History</h1>
          <p className="text-muted-foreground">View and manage your chat version history.</p>
        </div>
        <VersionManager versions={[]} />
      </div>
    </div>
  )
}
