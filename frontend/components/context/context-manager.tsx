"use client"

import * as React from "react"
import { Hash, File, Folder, Code, Search, Plus, X, Link, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

interface ContextItem {
  id: string
  type: "file" | "folder" | "symbol" | "selection" | "url" | "database"
  name: string
  path: string
  content?: string
  metadata?: Record<string, any>
  tags: string[]
  lastUsed: Date
  autoAttach?: boolean
}

const sampleContextItems: ContextItem[] = [
  {
    id: "1",
    type: "file",
    name: "api.ts",
    path: "/src/lib/api.ts",
    content: "// API configuration and utilities",
    tags: ["api", "typescript"],
    lastUsed: new Date("2024-01-15"),
    autoAttach: true,
  },
  {
    id: "2",
    type: "folder",
    name: "components",
    path: "/src/components",
    tags: ["react", "ui"],
    lastUsed: new Date("2024-01-14"),
  },
  {
    id: "3",
    type: "symbol",
    name: "UserProvider",
    path: "/src/providers/user-provider.tsx:15",
    tags: ["react", "context"],
    lastUsed: new Date("2024-01-13"),
  },
]

export function ContextManager() {
  const [contextItems, setContextItems] = React.useState<ContextItem[]>(sampleContextItems)
  const [selectedItems, setSelectedItems] = React.useState<string[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filterType, setFilterType] = React.useState<string>("all")
  const [newItemPath, setNewItemPath] = React.useState("")
  const [newItemType, setNewItemType] = React.useState<ContextItem["type"]>("file")

  const filteredItems = React.useMemo(() => {
    return contextItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesType = filterType === "all" || item.type === filterType

      return matchesSearch && matchesType
    })
  }, [contextItems, searchQuery, filterType])

  const handleAddContext = () => {
    if (!newItemPath.trim()) return

    const newItem: ContextItem = {
      id: Date.now().toString(),
      type: newItemType,
      name: newItemPath.split("/").pop() || newItemPath,
      path: newItemPath,
      tags: [],
      lastUsed: new Date(),
    }

    setContextItems((prev) => [newItem, ...prev])
    setNewItemPath("")
  }

  const handleRemoveContext = (id: string) => {
    setContextItems((prev) => prev.filter((item) => item.id !== id))
    setSelectedItems((prev) => prev.filter((itemId) => itemId !== id))
  }

  const handleToggleSelection = (id: string) => {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]))
  }

  const handleToggleAutoAttach = (id: string) => {
    setContextItems((prev) => prev.map((item) => (item.id === id ? { ...item, autoAttach: !item.autoAttach } : item)))
  }

  const getTypeIcon = (type: ContextItem["type"]) => {
    switch (type) {
      case "file":
        return File
      case "folder":
        return Folder
      case "symbol":
        return Code
      case "selection":
        return Hash
      case "url":
        return Link
      case "database":
        return Database
      default:
        return File
    }
  }

  const getTypeColor = (type: ContextItem["type"]) => {
    switch (type) {
      case "file":
        return "bg-blue-100 text-blue-800"
      case "folder":
        return "bg-green-100 text-green-800"
      case "symbol":
        return "bg-purple-100 text-purple-800"
      case "selection":
        return "bg-orange-100 text-orange-800"
      case "url":
        return "bg-cyan-100 text-cyan-800"
      case "database":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Context Manager</h3>
          <p className="text-sm text-muted-foreground">Manage files, folders, and symbols for AI context</p>
        </div>
        <Badge variant="secondary">{selectedItems.length} selected</Badge>
      </div>

      <Tabs defaultValue="browser" className="space-y-4">
        <TabsList>
          <TabsTrigger value="browser">Context Browser</TabsTrigger>
          <TabsTrigger value="auto-attach">Auto-Attach Rules</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
        </TabsList>

        <TabsContent value="browser" className="space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search context items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="file">Files</SelectItem>
                <SelectItem value="folder">Folders</SelectItem>
                <SelectItem value="symbol">Symbols</SelectItem>
                <SelectItem value="selection">Selections</SelectItem>
                <SelectItem value="url">URLs</SelectItem>
                <SelectItem value="database">Database</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Add New Context */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Add Context Item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Select value={newItemType} onValueChange={(value: ContextItem["type"]) => setNewItemType(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">File</SelectItem>
                    <SelectItem value="folder">Folder</SelectItem>
                    <SelectItem value="symbol">Symbol</SelectItem>
                    <SelectItem value="selection">Selection</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="database">Database</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Enter path or reference..."
                  value={newItemPath}
                  onChange={(e) => setNewItemPath(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddContext} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Context Items List */}
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const Icon = getTypeIcon(item.type)
                const isSelected = selectedItems.includes(item.id)

                return (
                  <Card
                    key={item.id}
                    className={`cursor-pointer transition-colors ${isSelected ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => handleToggleSelection(item.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{item.name}</p>
                            <p className="text-sm text-muted-foreground truncate">{item.path}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${getTypeColor(item.type)}`}>{item.type}</Badge>

                          {item.autoAttach && (
                            <Badge variant="outline" className="text-xs">
                              Auto
                            </Badge>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveContext(item.id)
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="auto-attach" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Attachment Rules</CardTitle>
              <CardDescription>Configure automatic context attachment based on conditions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contextItems
                .filter((item) => item.autoAttach)
                .map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {React.createElement(getTypeIcon(item.type), { className: "h-4 w-4" })}
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                    </div>

                    <Switch checked={item.autoAttach} onCheckedChange={() => handleToggleAutoAttach(item.id)} />
                  </div>
                ))}

              {contextItems.filter((item) => item.autoAttach).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No auto-attachment rules configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Configuration</CardTitle>
              <CardDescription>Configure workspace-wide context settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Workspace Root</Label>
                <Input placeholder="/path/to/workspace" />
              </div>

              <div className="space-y-2">
                <Label>Ignore Patterns</Label>
                <Textarea
                  placeholder="node_modules/&#10;*.log&#10;.git/"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Include Extensions</Label>
                <Input placeholder=".ts,.tsx,.js,.jsx,.py,.md" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-detect Context</Label>
                  <p className="text-sm text-muted-foreground">Automatically detect relevant files</p>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Include Git History</Label>
                  <p className="text-sm text-muted-foreground">Include recent commits in context</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
