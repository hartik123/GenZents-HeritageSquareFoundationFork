import { create } from "zustand"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/utils/logger"
import type { Change, Chat, Version } from "@/lib/types"

interface VersionState {
  versions: Version[]
  currentVersion: Version | null
  loading: boolean

  loadVersions: (chatId: string) => Promise<void>
  createVersion: (chatId: string, description?: string) => Promise<void>
  rollbackToVersion: (versionId: string) => Promise<void>
  deleteVersion: (versionId: string) => Promise<void>
  compareVersions: (version1Id: string, version2Id: string) => Promise<Change[]>
  getVersionDiff: (versionId: string) => Promise<Change[]>
  exportVersion: (versionId: string) => Promise<string>
  importVersion: (data: string) => Promise<void>
}

export const useVersionStore = create<VersionState>((set, get) => ({
  versions: [],
  currentVersion: null,
  loading: false,

  loadVersions: async (chatId: string) => {
    try {
      set({ loading: true })
      const supabase = createClient()

      const { data: versions, error } = await supabase
        .from("chat_versions")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })

      if (error) throw error

      set({ versions: versions || [], loading: false })
    } catch (error) {
      logger.error("Error loading versions", error as Error, { component: "version-store", chatId })
      set({ loading: false })
    }
  },

  createVersion: async (chatId: string, description?: string) => {
    try {
      const supabase = createClient()

      const { data: chat, error: chatError } = await supabase.from("chats").select("*").eq("id", chatId).single()

      if (chatError) throw chatError

      const { data: lastVersion } = await supabase
        .from("chat_versions")
        .select("version")
        .eq("chat_id", chatId)
        .order("version", { ascending: false })
        .limit(1)
        .single()

      const nextVersion = (parseInt(lastVersion?.version || "0") + 1).toString()

      const { data: version, error } = await supabase
        .from("chat_versions")
        .insert({
          chat_id: chatId,
          version: nextVersion,
          title: `Version ${nextVersion}`,
          description: description || `Version ${nextVersion}`,
          data: chat,
          user_id: chat.user_id,
          timestamp: new Date(),
          status: "current",
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        versions: [version, ...state.versions],
      }))
    } catch (error) {
      logger.error("Error creating version", error as Error, { component: "version-store", chatId })
      throw error
    }
  },

  rollbackToVersion: async (versionId: string) => {
    try {
      const supabase = createClient()

      const { data: version, error: versionError } = await supabase
        .from("chat_versions")
        .select("*")
        .eq("id", versionId)
        .single()

      if (versionError) throw versionError

      const chatData = version.data as Chat

      const { error: updateError } = await supabase
        .from("chats")
        .update({
          title: chatData.title,
          metadata: chatData.metadata,
          context_summary: chatData.context_summary,
          status: chatData.status,
        })
        .eq("id", chatData.id)

      if (updateError) throw updateError

      await get().createVersion(chatData.id, `Rolled back to version ${version.version}`)
    } catch (error) {
      logger.error("Error rolling back to version", error as Error, { component: "version-store", versionId })
      throw error
    }
  },

  deleteVersion: async (versionId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("chat_versions").delete().eq("id", versionId)

      if (error) throw error

      set((state) => ({
        versions: state.versions.filter((v) => v.id !== versionId),
      }))
    } catch (error) {
      logger.error("Error deleting version", error as Error, { component: "version-store", versionId })
      throw error
    }
  },

  compareVersions: async (version1Id: string, version2Id: string) => {
    try {
      const supabase = createClient()

      const [{ data: version1 }, { data: version2 }] = await Promise.all([
        supabase.from("chat_versions").select("*").eq("id", version1Id).single(),
        supabase.from("chat_versions").select("*").eq("id", version2Id).single(),
      ])

      if (!version1 || !version2) throw new Error("Versions not found")

      const changes: Change[] = []
      const data1 = version1.data as Chat
      const data2 = version2.data as Chat

      if (data1.title !== data2.title) {
        changes.push({
          id: `title-${Date.now()}`,
          version_id: version2Id,
          type: "modified",
          originalPath: "title",
          originalValue: data1.title,
          newValue: data2.title,
          description: "Title changed",
          timestamp: new Date(),
        })
      }

      if (JSON.stringify(data1.metadata) !== JSON.stringify(data2.metadata)) {
        changes.push({
          id: `metadata-${Date.now()}`,
          version_id: version2Id,
          type: "modified",
          originalPath: "metadata",
          originalValue: data1.metadata,
          newValue: data2.metadata,
          description: "Metadata updated",
          timestamp: new Date(),
        })
      }

      return changes
    } catch (error) {
      logger.error("Error comparing versions", error as Error, { component: "version-store", version1Id, version2Id })
      return []
    }
  },

  getVersionDiff: async (versionId: string) => {
    try {
      const versions = get().versions
      const versionIndex = versions.findIndex((v) => v.id === versionId)

      if (versionIndex === -1 || versionIndex === versions.length - 1) return []

      const currentVersion = versions[versionIndex]
      const previousVersion = versions[versionIndex + 1]

      return await get().compareVersions(previousVersion.id, currentVersion.id)
    } catch (error) {
      logger.error("Error getting version diff", error as Error, { component: "version-store", versionId })
      return []
    }
  },

  exportVersion: async (versionId: string) => {
    try {
      const version = get().versions.find((v) => v.id === versionId)
      if (!version) throw new Error("Version not found")

      return JSON.stringify(version, null, 2)
    } catch (error) {
      logger.error("Error exporting version", error as Error, { component: "version-store", versionId })
      throw error
    }
  },

  importVersion: async (data: string) => {
    try {
      const version = JSON.parse(data) as Version
      const supabase = createClient()

      const { error } = await supabase.from("chat_versions").insert({
        ...version,
        id: undefined,
        created_at: new Date().toISOString(),
      })

      if (error) throw error

      await get().loadVersions(version.id)
    } catch (error) {
      logger.error("Error importing version", error as Error, { component: "version-store" })
      throw error
    }
  },
}))
