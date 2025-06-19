import { Metadata } from "next"
import { VersionHistory } from "@/components/version"

export const metadata: Metadata = {
  title: "Version",
  description: "View and manage your version history.",
  keywords: ["version", "history", "management"],
  openGraph: {
    title: "Version",
    description: "View and manage your version history.",
    url: "/version",
    type: "website",
  },
}

export default function VersionHistoryPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <VersionHistory />
    </div>
  )
}
