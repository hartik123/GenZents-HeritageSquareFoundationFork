"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { logger } from "@/lib/utils/logger"
import { SecureStorage } from "@/lib/utils/local-storage"
import { contextService } from "@/lib/services/context-service"
import { createClient } from "@/lib/supabase/client"
import type { Settings } from "@/lib/types/user"
import type { UserPreferences } from "@/lib/types/user"

// Extend the centralized Settings interface with additional properties specific to this provider
interface ExtendedSettings extends Settings {
  // Privacy and data
  saveHistory: boolean
  shareAnalytics: boolean
  apiKeys: {
    openai?: string
    anthropic?: string
  }

  // Developer settings
  showDebugInfo: boolean
  enableAdvancedFeatures: boolean
  customCSS: string
  apiEndpoint: string

  // Collaboration
  allowCollaboration: boolean
  defaultPermissions: string
  invitationMode: string

  // Shortcuts and productivity
  keyboardShortcuts: Record<string, any>
  shortcuts: any[]
  autoSave: boolean
  autoSaveInterval: number

  // Connections and integrations
  googleDriveConnected: boolean
  googleDriveEmail: string
  googleDriveAutoSync: boolean
  googleDriveSyncFrequency: "realtime" | "hourly" | "daily" | "weekly"
  shareUsageWithIntegrations: boolean
  crossPlatformSync: boolean

  // Tools and commands
  enableCommands: boolean
  autoCommandSuggestions: boolean
  showCommandHelp: boolean
  enabledCommands: string[]
}

interface SettingsContextProps {
  settings: ExtendedSettings
  updateSetting: (key: keyof ExtendedSettings, value: any) => void
  updateUserPreferences: (preferences: Partial<UserPreferences>) => Promise<void>
  syncSettingsWithServer: () => Promise<void>
  resetSettings: () => void
  exportSettings: () => void
  importSettings: (importedSettings: Partial<ExtendedSettings>) => void
}

const defaultSettings: ExtendedSettings = {
  // Theme and appearance
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
  showTokenCount: false,
  compactMode: false,
  fullScreenMode: false,
  showAvatars: true,

  // Export settings
  exportFormat: "json",
  includeMetadata: true,
  includeSystemMessages: true,

  // Security and privacy
  encryptMessages: false,
  retentionDays: 30,
  allowTelemetry: false,

  // Developer settings
  showDebugInfo: false,
  enableAdvancedFeatures: false,
  customCSS: "",
  apiEndpoint: "",

  // Collaboration
  allowCollaboration: true,
  defaultPermissions: "view",
  invitationMode: "manual",

  // Shortcuts and productivity
  keyboardShortcuts: {},
  shortcuts: [],
  autoSave: true,
  autoSaveInterval: 30,

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

  // Tools and commands
  enableCommands: true,
  autoCommandSuggestions: true,
  showCommandHelp: true,
  enabledCommands: ["organize", "folder", "search", "cleanup", "help"],
}

const SettingsContext = createContext<SettingsContextProps>({
  settings: defaultSettings,
  updateSetting: () => {},
  updateUserPreferences: async () => {},
  syncSettingsWithServer: async () => {},
  resetSettings: () => {},
  exportSettings: () => {},
  importSettings: () => {},
})

interface SettingsProviderProps {
  children: ReactNode
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<ExtendedSettings>(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await SecureStorage.getItem<ExtendedSettings>("settings")
        return storedSettings ? { ...defaultSettings, ...storedSettings } : defaultSettings
      } catch (error) {
        logger.error("Error loading stored settings", error as Error, { component: "settings-provider" })
        return defaultSettings
      }
    }
    // For now, return default settings and load async in useEffect
    return defaultSettings
  })

  const supabase = createClient()

  /**
   * Sync settings with server
   */
  const syncSettingsWithServer = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        logger.info("User not authenticated, skipping server sync")
        return
      }

      // Fetch user preferences from server
      const serverPreferences = await contextService.getUserPreferences(user.id)

      // Update local settings with server data
      const settingsUpdate = contextService.preferencesToSettings(serverPreferences)
      setSettings((prev) => ({ ...prev, ...settingsUpdate }))

      logger.info("Settings synced with server successfully")
    } catch (error) {
      logger.error("Error syncing settings with server", error as Error)
      // Don't throw - just log the error as sync failure shouldn't break the app
    }
  }, [supabase])

  // Load settings from secure storage and server on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load from local storage first
        const storedSettings = await SecureStorage.getItem<ExtendedSettings>("settings")
        if (storedSettings) {
          setSettings((prev) => ({ ...prev, ...storedSettings }))
        }

        // Sync with server if user is authenticated
        await syncSettingsWithServer()
      } catch (error) {
        logger.error("Error loading stored settings", error as Error, { component: "settings-provider" })
      }
    }
    loadSettings()
  }, [syncSettingsWithServer])

  useEffect(() => {
    SecureStorage.setItem("settings", settings, {
      encrypt: false, // Settings don't need encryption but could be enabled for sensitive data
      expiryHours: 24 * 30, // 30 days
    })
  }, [settings])

  const updateSetting = (key: keyof ExtendedSettings, value: any) => {
    setSettings((prevSettings) => ({
      ...prevSettings,
      [key]: value,
    }))
  }

  /**
   * Update user preferences on the server for enhanced context processing
   */
  const updateUserPreferences = async (preferences: Partial<UserPreferences>) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        logger.warn("User not authenticated, cannot update preferences")
        return
      }

      await contextService.updateUserPreferences(user.id, preferences)

      // Update local settings to match
      const settingsUpdate = contextService.preferencesToSettings(preferences as UserPreferences)
      setSettings((prev) => ({ ...prev, ...settingsUpdate }))

      logger.info("User preferences updated successfully")
    } catch (error) {
      logger.error("Error updating user preferences", error as Error)
      throw error
    }
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

  const importSettings = (importedSettings: Partial<ExtendedSettings>) => {
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
        updateUserPreferences,
        syncSettingsWithServer,
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
