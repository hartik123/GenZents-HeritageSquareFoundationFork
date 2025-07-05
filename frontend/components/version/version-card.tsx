import { memo, useState } from "react"
import { Calendar, User, RotateCcw, Download, Eye, MoreVertical } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Version } from "@/lib/types/version"
import { getStatusColor, exportVersion } from "@/lib/utils/version"

interface VersionCardProps {
  version: Version
  onRollback: (versionId: string) => void
}

export const VersionCard = memo<VersionCardProps>(function VersionCard({ version, onRollback }) {
  const [isRollingBack, setIsRollingBack] = useState(false)

  const handleRollback = async () => {
    setIsRollingBack(true)
    try {
      await onRollback(version.id)
    } finally {
      setIsRollingBack(false)
    }
  }

  const handleExport = () => {
    exportVersion(version)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card className="transition-colors hover:bg-muted/50">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                v{version.version}
              </Badge>
              <Badge className={getStatusColor(version.status)}>{version.status}</Badge>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Version
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                {version.status !== "current" && (
                  <DropdownMenuItem onClick={handleRollback} disabled={isRollingBack}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {isRollingBack ? "Rolling back..." : "Rollback"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-1">{version.title}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2">{version.description}</p>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <User className="h-3 w-3" />
              <span>{version.user_id}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(version.created_at)}</span>
            </div>
          </div>

          {version.status !== "current" && (
            <div className="pt-2 border-t">
              <Button size="sm" variant="outline" onClick={handleRollback} disabled={isRollingBack} className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                {isRollingBack ? "Rolling back..." : "Rollback to this version"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
