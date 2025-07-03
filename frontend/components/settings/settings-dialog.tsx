"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Download, Upload, RotateCcw, LogOut, Settings, Palette, User, Shield } from "lucide-react"
import { useSettingsStore } from "@/lib/stores/settings-store"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useTheme } from "@/hooks/theme-provider"
import { useToast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/theme-toggle"

const settingsSections = [
  { id: "general", label: "General", icon: Settings },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "chat", label: "Chat", icon: User },
  { id: "privacy", label: "Privacy", icon: Shield },
]

export function SettingsDialog({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState("general")
  const settings = useSettingsStore()
  const { signOut } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

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
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">General Settings</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={settings.language || "en"}
                    onValueChange={(value) => settings.updateSetting("language", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-4 text-destructive">Danger Zone</h4>
                  <div className="space-y-4">
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        await signOut()
                        toast({ title: "Signed out successfully" })
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

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
                <div className="space-y-4">
                  <h4 className="font-medium">API Keys</h4>
                  <div className="space-y-2">
                    <Label>OpenAI API Key</Label>
                    <Input
                      type="password"
                      value={settings.apiKeys?.openai || ""}
                      onChange={(e) =>
                        settings.updateSetting("apiKeys", { ...settings.apiKeys, openai: e.target.value })
                      }
                      placeholder="sk-..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Anthropic API Key</Label>
                    <Input
                      type="password"
                      value={settings.apiKeys?.anthropic || ""}
                      onChange={(e) =>
                        settings.updateSetting("apiKeys", { ...settings.apiKeys, anthropic: e.target.value })
                      }
                      placeholder="sk-ant-..."
                    />
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
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeSection === section.id
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
