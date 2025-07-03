"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { logger } from "@/lib/utils/logger"
import { SecureStorage } from "@/lib/utils/local-storage"
import type { Settings, UserPreferences } from "@/lib/types"

interface SettingsContextProps {
  settings: Settings
  updateSetting: (key: keyof Settings, value: any) => void
  resetSettings: () => void
  exportSettings: () => void
  importSettings: (importedSettings: Partial<Settings>) => void
}

const defaultSettings: Settings = {
  language: "en",
  showFollowUpSuggestions: true,
  chats: [],
  temperature: 0.7,
  systemPrompt: "",
  maxTokens: 2048,
  customInstructions: "",
  communicationStyle: "balanced",
  responseLength: "balanced",
  showTimestamps: false,
  showTokenCount: false,
  showAvatars: true,
  compactMode: false,
  fullScreenMode: false,
  exportFormat: "json",
  includeMetadata: true,
  encryptMessages: false,
  retentionDays: 30,
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
  const [settings, setSettings] = useState<Settings>(defaultSettings)

  // Load settings from storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await SecureStorage.getItem<Settings>("settings")
        if (storedSettings) {
          setSettings((prev) => ({ ...prev, ...storedSettings }))
        }
      } catch (error) {
        logger.error("Error loading stored settings", error as Error, { component: "settings-provider" })
      }
    }
    loadSettings()
  }, [])

  // Save settings to storage when they change
  useEffect(() => {
    SecureStorage.setItem("settings", settings, {
      encrypt: false,
      expiryHours: 24 * 30, // 30 days
    })
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
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        resetSettings,
        exportSettings,
        importSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
