import { memo } from "react"
import { History } from "lucide-react"

export const EmptyVersionState = memo(function EmptyVersionState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-md">
        <History className="h-16 w-16 mx-auto text-muted-foreground/50" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">No Versions Found</h3>
          <p className="text-muted-foreground text-sm">
            No versions have been created yet. Create your first version to track changes and enable rollback
            functionality.
          </p>
        </div>
      </div>
    </div>
  )
})
