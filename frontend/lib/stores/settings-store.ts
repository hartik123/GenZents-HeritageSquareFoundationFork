import { create } from "zustand"
import { persist } from "zustand/middleware"
import { logger } from "@/lib/utils/logger"
import type { UserPreferences } from "@/lib/types"

interface SettingsState extends UserPreferences {
  chats: any[]
  googleDriveConnected: boolean
  googleDriveEmail: string
  googleDriveAutoSync: boolean
  googleDriveSyncFrequency: "realtime" | "hourly" | "daily" | "weekly"
  shareUsageWithIntegrations: boolean
  crossPlatformSync: boolean

  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void
  resetSettings: () => void
  exportSettings: () => string
  importSettings: (settings: string) => void
}

const defaultSettings: Omit<SettingsState, "updateSetting" | "resetSettings" | "exportSettings" | "importSettings"> = {
  theme: "system",
  language: "en",
  timezone: "UTC",
  notifications: {
    email: false,
    push: false,
    desktop: false,
    sound: false,
  },
  communicationStyle: "balanced",
  responseLength: "balanced",
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: "",
  chats: [],
  googleDriveConnected: false,
  googleDriveEmail: "",
  googleDriveAutoSync: false,
  googleDriveSyncFrequency: "daily",
  shareUsageWithIntegrations: false,
  crossPlatformSync: true,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      updateSetting: (key, value) => {
        if (key === "language") {
          set((state) => ({ ...state, language: "en" }))
        } else {
          set((state) => ({ ...state, [key]: value }))
        }
      },

      resetSettings: () => {
        set(defaultSettings)
      },

      exportSettings: () => {
        const settings = get()
        return JSON.stringify(settings, null, 2)
      },

      importSettings: (settingsJson: string) => {
        try {
          const settings = JSON.parse(settingsJson)
          // Always force language to English
          set({ ...defaultSettings, ...settings, language: "en" })
        } catch (error) {
          logger.error("Failed to import settings", error as Error, { component: "settings-store" })
        }
      },
    }),
    {
      name: "settings-storage",
    }
  )
)
