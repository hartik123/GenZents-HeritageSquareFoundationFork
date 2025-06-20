import { create } from "zustand"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/utils/logger"
import type { Collaborator, Comment, ShareSettings } from "@/lib/types/chat"

// Remove duplicate interfaces as they now come from centralized types

interface CollaborationState {
  collaborators: Collaborator[]
  comments: Comment[]
  shareSettings: ShareSettings
  isConnected: boolean
  currentUser: Collaborator | null

  // Real-time collaboration
  connectToChat: (chatId: string) => Promise<void>
  disconnect: () => void
  updateCursor: (position: { x: number; y: number }) => void

  // User management
  inviteUser: (email: string, role: Collaborator["role"]) => Promise<void>
  removeUser: (userId: string) => Promise<void>
  updateUserRole: (userId: string, role: Collaborator["role"]) => Promise<void>

  // Comments
  addComment: (messageId: string, content: string) => Promise<void>
  replyToComment: (commentId: string, content: string) => Promise<void>
  resolveComment: (commentId: string) => Promise<void>
  deleteComment: (commentId: string) => Promise<void>

  // Sharing
  updateShareSettings: (settings: Partial<ShareSettings>) => Promise<void>
  generateShareLink: () => Promise<string>

  // Voice/Video (placeholder for future implementation)
  startVoiceCall: () => Promise<void>
  startVideoCall: () => Promise<void>
  startScreenShare: () => Promise<void>
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  collaborators: [],
  comments: [],
  shareSettings: {
    isPublic: false,
    allowComments: true,
    allowEditing: false,
  },
  isConnected: false,
  currentUser: null,

  connectToChat: async (chatId: string) => {
    try {
      const supabase = createClient()

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Set up real-time subscription (placeholder)
      set({ isConnected: true })

      // Load existing collaborators and comments
      const { data: collaborators } = await supabase.from("chat_collaborators").select("*").eq("chat_id", chatId)

      const { data: comments } = await supabase.from("chat_comments").select("*").eq("chat_id", chatId)

      set({
        collaborators: collaborators || [],
        comments: comments || [],
      })
    } catch (error) {
      logger.error("Error connecting to chat", error as Error, { component: "collaboration-store", chatId })
    }
  },

  disconnect: () => {
    set({ isConnected: false, collaborators: [], comments: [] })
  },

  updateCursor: (position: { x: number; y: number }) => {
    // Real-time cursor updates would be implemented here
    logger.debug("Cursor updated", { component: "collaboration-store", position })
  },

  inviteUser: async (email: string, role: Collaborator["role"]) => {
    try {
      const supabase = createClient()

      // Send invitation (placeholder)
      logger.info(`Inviting ${email} as ${role}`, { component: "collaboration-store" })

      // In a real implementation, this would:
      // 1. Send an email invitation
      // 2. Create a pending invitation record
      // 3. Update the UI
    } catch (error) {
      logger.error("Error inviting user", error as Error, { component: "collaboration-store", email, role })
      throw error
    }
  },

  removeUser: async (userId: string) => {
    try {
      const supabase = createClient()

      await supabase.from("chat_collaborators").delete().eq("user_id", userId)

      set((state) => ({
        collaborators: state.collaborators.filter((c) => c.id !== userId),
      }))
    } catch (error) {
      logger.error("Error removing user", error as Error, { component: "collaboration-store", userId })
      throw error
    }
  },

  updateUserRole: async (userId: string, role: Collaborator["role"]) => {
    try {
      const supabase = createClient()

      await supabase.from("chat_collaborators").update({ role }).eq("user_id", userId)

      set((state) => ({
        collaborators: state.collaborators.map((c) => (c.id === userId ? { ...c, role } : c)),
      }))
    } catch (error) {
      logger.error("Error updating user role", error as Error, { component: "collaboration-store", userId, role })
      throw error
    }
  },

  addComment: async (messageId: string, content: string) => {
    try {
      const supabase = createClient()

      const { data: comment, error } = await supabase
        .from("chat_comments")
        .insert({
          message_id: messageId,
          content,
          resolved: false,
        })
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        comments: [...state.comments, comment],
      }))
    } catch (error) {
      logger.error("Error adding comment", error as Error, { component: "collaboration-store", messageId, content })
      throw error
    }
  },

  replyToComment: async (commentId: string, content: string) => {
    try {
      const supabase = createClient()

      const { data: reply, error } = await supabase
        .from("chat_comments")
        .insert({
          parent_id: commentId,
          content,
          resolved: false,
        })
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        comments: state.comments.map((c) => (c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c)),
      }))
    } catch (error) {
      logger.error("Error replying to comment", error as Error, {
        component: "collaboration-store",
        commentId,
        content,
      })
      throw error
    }
  },

  resolveComment: async (commentId: string) => {
    try {
      const supabase = createClient()

      await supabase.from("chat_comments").update({ resolved: true }).eq("id", commentId)

      set((state) => ({
        comments: state.comments.map((c) => (c.id === commentId ? { ...c, resolved: true } : c)),
      }))
    } catch (error) {
      logger.error("Error resolving comment", error as Error, { component: "collaboration-store", commentId })
      throw error
    }
  },

  deleteComment: async (commentId: string) => {
    try {
      const supabase = createClient()

      await supabase.from("chat_comments").delete().eq("id", commentId)

      set((state) => ({
        comments: state.comments.filter((c) => c.id !== commentId),
      }))
    } catch (error) {
      logger.error("Error deleting comment", error as Error, { component: "collaboration-store", commentId })
      throw error
    }
  },

  updateShareSettings: async (settings: Partial<ShareSettings>) => {
    try {
      set((state) => ({
        shareSettings: { ...state.shareSettings, ...settings },
      }))

      // Save to database
      const supabase = createClient()
      // Implementation would save share settings
    } catch (error) {
      logger.error("Error updating share settings", error as Error, { component: "collaboration-store", settings })
      throw error
    }
  },

  generateShareLink: async () => {
    try {
      // Generate a secure share link
      const shareId = Math.random().toString(36).substring(2, 15)
      return `${window.location.origin}/shared/${shareId}`
    } catch (error) {
      logger.error("Error generating share link", error as Error, { component: "collaboration-store" })
      throw error
    }
  },

  // Placeholder implementations for voice/video features
  startVoiceCall: async () => {
    logger.info("Voice call feature - to be implemented with WebRTC", { component: "collaboration-store" })
  },

  startVideoCall: async () => {
    logger.info("Video call feature - to be implemented with WebRTC", { component: "collaboration-store" })
  },

  startScreenShare: async () => {
    logger.info("Screen share feature - to be implemented with WebRTC", { component: "collaboration-store" })
  },
}))
