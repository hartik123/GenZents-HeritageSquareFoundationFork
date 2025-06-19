import { Metadata } from "next"
import { ContextManager } from "@/components/context/context-manager"

export const metadata: Metadata = {
  title: "Context",
  description: "Manage your context settings.",
  keywords: ["context", "settings"],
  openGraph: {
    title: "Context",
    description: "Manage your context settings.",
    url: "/context",
    type: "website",
  },
}

export default function ContextPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <ContextManager />
    </div>
  )
}
