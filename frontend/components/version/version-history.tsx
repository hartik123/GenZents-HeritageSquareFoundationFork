"use client"

import * as React from "react"
import { History, GitBranch, RotateCcw, Download, Calendar, User, Eye, ContrastIcon as Compare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"

interface Version {
  id: string
  version: string
  title: string
  description: string
  author: string
  date: Date
  branch: string
  tag?: string
  changes: Change[]
  status: "current" | "previous" | "archived"
}

interface Change {
  id: string
  type: "added" | "modified" | "deleted"
  file: string
  description: string
  linesAdded: number
  linesRemoved: number
}

const sampleVersions: Version[] = [
  {
    id: "v1.3.0",
    version: "1.3.0",
    title: "Enhanced Chat Interface",
    description: "Added voice input, file attachments, and improved message formatting",
    author: "John Doe",
    date: new Date("2024-01-15T10:30:00"),
    branch: "main",
    tag: "stable",
    status: "current",
    changes: [
      {
        id: "1",
        type: "added",
        file: "components/chat/voice-input.tsx",
        description: "Added voice input functionality",
        linesAdded: 120,
        linesRemoved: 0,
      },
      {
        id: "2",
        type: "modified",
        file: "components/chat/chat-input.tsx",
        description: "Enhanced input with file attachments",
        linesAdded: 45,
        linesRemoved: 12,
      },
    ],
  },
  {
    id: "v1.2.1",
    version: "1.2.1",
    title: "Bug Fixes and Performance",
    description: "Fixed memory leaks and improved response times",
    author: "Jane Smith",
    date: new Date("2024-01-10T14:20:00"),
    branch: "main",
    status: "previous",
    changes: [
      {
        id: "3",
        type: "modified",
        file: "components/providers/chat-provider.tsx",
        description: "Fixed memory leak in message handling",
        linesAdded: 8,
        linesRemoved: 15,
      },
    ],
  },
  {
    id: "v1.2.0",
    version: "1.2.0",
    title: "Theme System",
    description: "Added dark mode and custom themes",
    author: "Bob Wilson",
    date: new Date("2024-01-05T09:15:00"),
    branch: "main",
    tag: "feature",
    status: "previous",
    changes: [
      {
        id: "4",
        type: "added",
        file: "components/theme-provider.tsx",
        description: "Added theme system",
        linesAdded: 200,
        linesRemoved: 0,
      },
    ],
  },
]

export function VersionHistory() {
  const { toast } = useToast()
  const [versions, setVersions] = React.useState<Version[]>(sampleVersions)
  const [selectedVersion, setSelectedVersion] = React.useState<Version | null>(versions[0])
  const [compareVersion, setCompareVersion] = React.useState<Version | null>(null)
  const [filterBranch, setFilterBranch] = React.useState("all")
  const [searchQuery, setSearchQuery] = React.useState("")

  const branches = React.useMemo(() => {
    const branchSet = new Set(versions.map((v) => v.branch))
    return Array.from(branchSet)
  }, [versions])

  const filteredVersions = React.useMemo(() => {
    return versions.filter((version) => {
      const matchesBranch = filterBranch === "all" || version.branch === filterBranch
      const matchesSearch =
        version.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        version.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        version.author.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesBranch && matchesSearch
    })
  }, [versions, filterBranch, searchQuery])

  const handleRollback = async (version: Version) => {
    try {
      // Simulate rollback process
      toast({
        title: "Rolling back...",
        description: `Rolling back to version ${version.version}`,
      })

      // Update version status
      setVersions((prev) =>
        prev.map((v) => ({
          ...v,
          status: v.id === version.id ? "current" : v.status === "current" ? "previous" : v.status,
        }))
      )

      setTimeout(() => {
        toast({
          title: "Rollback completed",
          description: `Successfully rolled back to version ${version.version}`,
        })
      }, 2000)
    } catch (error) {
      toast({
        title: "Rollback failed",
        description: "Failed to rollback to the selected version",
        variant: "destructive",
      })
    }
  }

  const handleExportVersion = (version: Version) => {
    const exportData = {
      version: version.version,
      title: version.title,
      description: version.description,
      changes: version.changes,
      date: version.date.toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `version-${version.version}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getChangeTypeColor = (type: Change["type"]) => {
    switch (type) {
      case "added":
        return "bg-green-100 text-green-800"
      case "modified":
        return "bg-blue-100 text-blue-800"
      case "deleted":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusColor = (status: Version["status"]) => {
    switch (status) {
      case "current":
        return "bg-green-100 text-green-800"
      case "previous":
        return "bg-blue-100 text-blue-800"
      case "archived":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="flex h-full">
      {/* Version List */}
      <div className="w-80 border-r bg-muted/30">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </h3>
          <p className="text-sm text-muted-foreground">Track and manage version changes</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Filters */}
          <div className="space-y-2">
            <Input
              placeholder="Search versions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch} value={branch}>
                    {branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Version List */}
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-2">
              {filteredVersions.map((version) => (
                <Card
                  key={version.id}
                  className={`cursor-pointer transition-colors ${
                    selectedVersion?.id === version.id ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedVersion(version)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{version.version}</Badge>
                          <Badge className={getStatusColor(version.status)}>{version.status}</Badge>
                        </div>
                        {version.tag && (
                          <Badge variant="secondary" className="text-xs">
                            {version.tag}
                          </Badge>
                        )}
                      </div>

                      <h4 className="font-medium text-sm">{version.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{version.description}</p>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{version.author}</span>
                        <Calendar className="h-3 w-3 ml-2" />
                        <span>{version.date.toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{version.branch}</span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {version.changes.length} changes
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Version Details */}
      <div className="flex-1 flex flex-col">
        {selectedVersion ? (
          <Tabs defaultValue="details" className="flex-1">
            <div className="border-b px-4 py-2">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="changes">Changes</TabsTrigger>
                  <TabsTrigger value="compare">Compare</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExportVersion(selectedVersion)}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  {selectedVersion.status !== "current" && (
                    <Button variant="default" size="sm" onClick={() => handleRollback(selectedVersion)}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Rollback
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <TabsContent value="details" className="flex-1 p-4">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        Version {selectedVersion.version}
                        <Badge className={getStatusColor(selectedVersion.status)}>{selectedVersion.status}</Badge>
                      </CardTitle>
                      {selectedVersion.tag && <Badge variant="secondary">{selectedVersion.tag}</Badge>}
                    </div>
                    <CardDescription>{selectedVersion.title}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">{selectedVersion.description}</p>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-muted-foreground">Author</Label>
                        <p className="font-medium">{selectedVersion.author}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Date</Label>
                        <p className="font-medium">{selectedVersion.date.toLocaleString()}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Branch</Label>
                        <p className="font-medium flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          {selectedVersion.branch}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Changes</Label>
                        <p className="font-medium">{selectedVersion.changes.length} files</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Change Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-green-600">
                          {selectedVersion.changes.reduce((sum, change) => sum + change.linesAdded, 0)}
                        </div>
                        <div className="text-sm text-muted-foreground">Lines Added</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-red-600">
                          {selectedVersion.changes.reduce((sum, change) => sum + change.linesRemoved, 0)}
                        </div>
                        <div className="text-sm text-muted-foreground">Lines Removed</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-blue-600">{selectedVersion.changes.length}</div>
                        <div className="text-sm text-muted-foreground">Files Changed</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="changes" className="flex-1 p-4">
              <Card>
                <CardHeader>
                  <CardTitle>File Changes</CardTitle>
                  <CardDescription>Detailed list of all changes in this version</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {selectedVersion.changes.map((change) => (
                        <div key={change.id} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex items-center gap-3">
                            <Badge className={getChangeTypeColor(change.type)}>{change.type}</Badge>
                            <div>
                              <p className="font-medium text-sm">{change.file}</p>
                              <p className="text-xs text-muted-foreground">{change.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm">
                            {change.linesAdded > 0 && <span className="text-green-600">+{change.linesAdded}</span>}
                            {change.linesRemoved > 0 && <span className="text-red-600">-{change.linesRemoved}</span>}
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compare" className="flex-1 p-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Compare Versions</CardTitle>
                    <CardDescription>Select another version to compare changes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Base Version</Label>
                        <div className="p-2 border rounded bg-muted/50">
                          <p className="font-medium">{selectedVersion.version}</p>
                          <p className="text-sm text-muted-foreground">{selectedVersion.title}</p>
                        </div>
                      </div>
                      <div>
                        <Label>Compare With</Label>
                        <Select
                          value={compareVersion?.id || ""}
                          onValueChange={(value) => {
                            const version = versions.find((v) => v.id === value)
                            setCompareVersion(version || null)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select version..." />
                          </SelectTrigger>
                          <SelectContent>
                            {versions
                              .filter((v) => v.id !== selectedVersion.id)
                              .map((version) => (
                                <SelectItem key={version.id} value={version.id}>
                                  {version.version} - {version.title}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {compareVersion && (
                      <Button className="w-full">
                        <Compare className="h-4 w-4 mr-2" />
                        Compare Versions
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {compareVersion && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Comparison Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <h4 className="font-medium">
                              {selectedVersion.version} ({selectedVersion.date.toLocaleDateString()})
                            </h4>
                            <div className="space-y-1">
                              <p>Changes: {selectedVersion.changes.length}</p>
                              <p>Author: {selectedVersion.author}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-medium">
                              {compareVersion.version} ({compareVersion.date.toLocaleDateString()})
                            </h4>
                            <div className="space-y-1">
                              <p>Changes: {compareVersion.changes.length}</p>
                              <p>Author: {compareVersion.author}</p>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div className="text-center text-sm text-muted-foreground">
                          Detailed diff comparison would be displayed here
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <History className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="text-lg font-semibold">No Version Selected</h3>
              <p className="text-muted-foreground">Select a version from the list to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
