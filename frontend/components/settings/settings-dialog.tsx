"use client"

import React, { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Download, Upload, RotateCcw, LogOut, Settings, Palette, User as UserIcon, Shield } from "lucide-react"
import { useSettingsStore } from "@/lib/stores/settings-store"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useTheme } from "@/hooks/theme-provider"
import { useToast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/theme-toggle"
import { supabase } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

const settingsSections = [
  { id: "general", label: "General", icon: Settings },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "chat", label: "Chat", icon: UserIcon },
  { id: "privacy", label: "Privacy", icon: Shield },
]

export function SettingsDialog({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState("general")
  const settings = useSettingsStore()
  const { signOut } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [customCommand, setCustomCommand] = React.useState("/")
  const [customDescription, setCustomDescription] = React.useState("")
  const [user, setUser] = useState<User | null>(null)
  const [userCommands, setUserCommands] = useState<any[]>([])

  // Fetch user once and set globally
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      if (user) fetchCommands(user.id)
    }
    getUser()
  }, [])

  const fetchCommands = async (userId: string) => {
    const { data, error } = await supabase
      .from("commands")
      .select("*")
      .eq("user_id", userId)

    if (!error && data) {
      const formattedCommands = data.map((cmd) => ({
        id: cmd.id,
        command: "/" + cmd.name,
        description: cmd.description,
      }))
      setUserCommands(formattedCommands)
    } else {
      console.error("Error fetching commands", error)
      toast({ title: "Failed to fetch commands", variant: "destructive" })
    }
  }

  const saveCommand = async () => {
    if (!customCommand.startsWith("/")) {
      toast({ title: "Command must start with /", variant: "destructive" })
      return
    }

    if (!user) {
      toast({ title: "Unauthorized - Please login first", variant: "destructive" })
      return
    }

    const { data, error: insertError } = await supabase
      .from("commands")
      .insert({
        user_id: user.id,
        name: customCommand.substring(1),
        description: customDescription,
        pattern: "^/cleanup$",
        instruction: customCommand.substring(1),
        type: "user"
      })
      .select("*")
      .single()

    if (insertError) {
      toast({ title: "Error saving command", description: insertError.message, variant: "destructive" })
    } else {
      toast({ title: "Command saved successfully!" })
      setCustomCommand("/")
      setCustomDescription("")

      setUserCommands((prev) => [
        ...prev,
        {
          id: data.id,
          command: "/" + data.name,
          description: data.description,
        },
      ])
      await fetchCommands(user.id);
    }
  }

  const deleteCommand = async (id: number) => {
    if (!user) return

    const { error } = await supabase.from("commands").delete().eq("id", id)

    if (error) {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" })
    } else {
      setUserCommands((prev) => prev.filter((cmd) => cmd.id !== id))
      toast({ title: "Command deleted" })
      await fetchCommands(user.id);
    }
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string)
          settings.importSettings(importedSettings)
          toast({ title: "Settings imported successfully" })
        } catch (error) {
          toast({ title: "Failed to import settings", variant: "destructive" })
        }
      }
      reader.readAsText(file)
    }
  }


  const renderSectionContent = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-6 p-4">
            <div>
              <h3 className="text-lg font-medium mb-6">General Settings</h3>
              <div className="space-y-6">
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="language">Language</Label>
                  <Input id="language" value="English" readOnly disabled />
                </div>

                {/* Custom Commands Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveCommand();
                  }}
                  className="max-w-xl space-y-4"
                >
                  <Label htmlFor="command">Custom Command</Label>
                  <div className="flex gap-4">
                    <Input
                      id="command"
                      placeholder="/example"
                      className="flex-1"
                      value={customCommand}
                      onChange={(e) => setCustomCommand(e.target.value)}
                    />
                    <Input
                      id="description"
                      placeholder="What this command does..."
                      className="flex-1"
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="mt-2">
                    Save Command
                  </Button>
                </form>

                {/* User Commands List */}
                {userCommands.length > 0 && (
                  <div className="max-w-xl">
                    <h4 className="font-medium mb-3">Your Commands</h4>
                    <div className="max-h-48 overflow-y-auto space-y-2 border rounded p-3 bg-white">
                      <ul>
                        {userCommands.map((cmd) => (
                          <li
                            key={cmd.id}
                            className="flex items-center border rounded p-2 gap-4 hover:bg-gray-50"
                          >
                            <div className="font-semibold w-36 truncate">{cmd.command}</div>
                            <div className="text-sm text-muted-foreground truncate flex-grow">
                              {cmd.description}
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteCommand(cmd.id)}
                              className="flex-shrink-0"
                            >
                              Delete
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Danger Zone */}
                <div className="max-w-md">
                  <h4 className="font-medium mb-4 text-destructive">Danger Zone</h4>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await signOut();
                      toast({ title: "Signed out successfully" });
                    }}
                    className="flex items-center"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );


      case "appearance":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Appearance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Theme</Label>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        )

      case "chat":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Chat Settings</h3>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-4">AI Configuration</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Communication Style</Label>
                      <Select
                        value={settings.communicationStyle || "balanced"}
                        onValueChange={(value) => settings.updateSetting("communicationStyle", value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="concise">Concise</SelectItem>
                          <SelectItem value="balanced">Balanced</SelectItem>
                          <SelectItem value="detailed">Detailed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Response Length</Label>
                      <Select
                        value={settings.responseLength || "balanced"}
                        onValueChange={(value) => settings.updateSetting("responseLength", value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">Short</SelectItem>
                          <SelectItem value="balanced">Balanced</SelectItem>
                          <SelectItem value="long">Long</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Temperature: {settings.temperature || 0.7}</Label>
                      <Slider
                        value={[settings.temperature || 0.7]}
                        onValueChange={(value) => settings.updateSetting("temperature", value[0])}
                        max={2}
                        min={0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max Tokens</Label>
                      <Input
                        type="number"
                        value={settings.maxTokens || 2048}
                        onChange={(e) => settings.updateSetting("maxTokens", Number.parseInt(e.target.value))}
                        min={1}
                        max={8192}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>System Prompt</Label>
                      <Textarea
                        value={settings.systemPrompt || ""}
                        onChange={(e) => settings.updateSetting("systemPrompt", e.target.value)}
                        placeholder="Enter a custom system prompt..."
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case "privacy":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Privacy & Data</h3>
              <div className="space-y-4">
                <div className="max-w-xl mb-4">
                  <Label className="font-medium mb-2 block">Google Drive Integration</Label>
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded p-3">
                    To use your own Google Drive, share your desired folder with
                    <div className="font-semibold text-foreground">drive-api-sa@kinetic-object-467721-p4.iam.gserviceaccount.com</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-4">Data Management</h4>
                  <div className="flex flex-wrap gap-4">
                    <Button
                      onClick={() => {
                        const data = settings.exportSettings()
                        const blob = new Blob([data], { type: "application/json" })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement("a")
                        a.href = url
                        a.download = "settings.json"
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      variant="outline"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Settings
                    </Button>
                    <div>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileImport}
                        className="hidden"
                        id="import-settings"
                      />
                      <Label htmlFor="import-settings" className="cursor-pointer">
                        <Button variant="outline" asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Import Settings
                          </span>
                        </Button>
                      </Label>
                    </div>
                    <Button
                      onClick={() => {
                        settings.resetSettings()
                        toast({ title: "Settings reset to defaults" })
                      }}
                      variant="destructive"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset to Defaults
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] p-0 flex flex-col">
        <div className="flex flex-1 min-h-0">
          <div className="w-64 bg-muted/30 border-r">
            <DialogHeader className="p-6 pb-4">
              <DialogTitle className="text-xl font-semibold">Settings</DialogTitle>
            </DialogHeader>
            <nav className="px-3">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${activeSection === section.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    }`}
                >
                  <section.icon className="h-4 w-4" />
                  {section.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1">
              <div className="p-6">{renderSectionContent()}</div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
