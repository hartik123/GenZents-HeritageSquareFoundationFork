import { memo } from "react"
import { Calendar, User, RotateCcw, Download, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Version } from "@/lib/types/version"
import { getStatusColor, exportVersion } from "@/lib/utils/version"

interface VersionDetailsProps {
  version: Version
  onRollback: (versionId: string) => void
  onBack: () => void
}

export const VersionDetails = memo<VersionDetailsProps>(function VersionDetails({ version, onRollback, onBack }) {
  const handleRollback = () => {
    onRollback(version.id)
  }

  const handleExport = () => {
    exportVersion(version)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Versions
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {version.status !== "current" && (
            <Button variant="default" size="sm" onClick={handleRollback}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Rollback
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                v{version.version}
              </Badge>
              <span>{version.title}</span>
            </CardTitle>
            <Badge className={getStatusColor(version.status)}>{version.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Description</h4>
            <p className="text-muted-foreground">{version.description}</p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <User className="h-4 w-4" />
                Created By
              </h4>
              <p className="text-muted-foreground">{version.user_id}</p>
            </div>
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created At
              </h4>
              <p className="text-muted-foreground">{formatDate(version.created_at)}</p>
            </div>
          </div>

          {version.data && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Version Data</h4>
                <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64">
                  {JSON.stringify(version.data, null, 2)}
                </pre>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
})
