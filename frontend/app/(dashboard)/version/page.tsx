"use client"

import { VersionManager } from "@/components/version"
import { supabase } from "@/lib/supabase/client"
import { Version } from "@/lib/types"
import { useEffect, useState } from "react"

export default function VersionHistoryPage() {
  const [versions, setVersions] = useState<Version[]>([])

  useEffect(() => {
    const fetchVersions = async () => {
      const { data, error } = await supabase
        .from("versions")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching versions:", error.message)
      } else {
        setVersions(data || [])
      }
    }

    fetchVersions()
  }, [])

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Version History</h1>
          <p className="text-muted-foreground">View and manage your chat version history.</p>
        </div>
        <VersionManager versions={versions} />
      </div>
    </div>
  )
}
