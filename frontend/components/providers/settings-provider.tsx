"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface Settings {
  // Theme and appearance
  fontSize: "small" | "medium" | "large"
  highContrast: boolean
  layoutDensity: string
  
  // General
  language: string
  showFollowUpSuggestions: boolean
  chats: any[]
  
  // Chat and AI model settings
  defaultModel: string
  temperature: number
  systemPrompt: string
  maxTokens: number
  customInstructions: string
  communicationStyle: "professional" | "casual" | "friendly" | "balanced" | "technical"
  responseLength: "concise" | "balanced" | "detailed" | "comprehensive"
  expertiseLevel: "beginner" | "intermediate" | "advanced" | "expert"
  
  // Display preferences
  showTimestamps: boolean
  showWordCount: boolean
  showModelInfo: boolean
  
  // Privacy and data
  saveHistory: boolean
  shareAnalytics: boolean
  apiKeys: {
    openai?: string
    anthropic?: string
  }
  
  // Connections and integrations
  googleDriveConnected: boolean
  googleDriveEmail: string
  googleDriveAutoSync: boolean
  googleDriveSyncFrequency: "realtime" | "hourly" | "daily" | "weekly"
  shareUsageWithIntegrations: boolean
  crossPlatformSync: boolean
}

interface SettingsContextProps {
  settings: Settings
  updateSetting: (key: keyof Settings, value: any) => void
  resetSettings: () => void
  exportSettings: () => void
  importSettings: (importedSettings: Partial<Settings>) => void
}

const defaultSettings: Settings = {
  // Theme and appearance
  fontSize: "medium",
  highContrast: false,
  layoutDensity: "comfortable",
  
  // General
  language: "en",
  showFollowUpSuggestions: true,
  chats: [],
  
  // Chat and AI model settings
  defaultModel: "gpt-4",
  temperature: 0.7,
  systemPrompt: "",
  maxTokens: 2048,
  customInstructions: "",
  communicationStyle: "balanced",
  responseLength: "balanced",
  expertiseLevel: "intermediate",
  
  // Display preferences
  showTimestamps: false,
  showWordCount: false,
  showModelInfo: false,
  
  // Privacy and data
  saveHistory: true,
  shareAnalytics: false,
  apiKeys: {},
  
  // Connections and integrations
  googleDriveConnected: false,
  googleDriveEmail: "",
  googleDriveAutoSync: false,
  googleDriveSyncFrequency: "daily",
  shareUsageWithIntegrations: false,
  crossPlatformSync: true,
}

const SettingsContext = createContext<SettingsContextProps>({
  settings: defaultSettings,
  updateSetting: () => {},
  resetSettings: () => {},
  exportSettings: () => {},
  importSettings: () => {},
})

interface SettingsProviderProps {
  children: ReactNode
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const storedSettings = localStorage.getItem("settings")
      return storedSettings ? JSON.parse(storedSettings) : defaultSettings
    } catch (error) {
      console.error("Error parsing stored settings:", error)
      return defaultSettings
    }
  })

  useEffect(() => {
    localStorage.setItem("settings", JSON.stringify(settings))
  }, [settings])

  const updateSetting = (key: keyof Settings, value: any) => {
    setSettings((prevSettings) => ({
      ...prevSettings,
      [key]: value,
    }))
  }

  const resetSettings = () => {
    setSettings(defaultSettings)
  }

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = "settings.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  const importSettings = (importedSettings: Partial<Settings>) => {
    setSettings((prevSettings) => ({
      ...prevSettings,
      ...importedSettings,
    }))
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings, exportSettings, importSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
