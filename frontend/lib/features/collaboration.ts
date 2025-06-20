import { supabase } from "@/lib/supabase/client"
import { logger } from "@/lib/utils/logger"
import type { Collaborator, Permission } from "@/lib/types"

export class CollaborationManager {
  static async inviteCollaborator(
    chatId: string,
    email: string,
    role: Collaborator["role"],
    permissions: Permission[]
  ) {
    // Create invitation
    const { data: invitation, error } = await supabase
      .from("chat_invitations")
      .insert({
        chat_id: chatId,
        email,
        role,
        permissions,
        invited_by: (await supabase.auth.getUser()).data.user?.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select()
      .single()

    if (error) throw error

    // Send invitation email
    await this.sendInvitationEmail(email, invitation.token, chatId)

    return invitation
  }

  static async acceptInvitation(token: string) {
    const { data: invitation, error } = await supabase
      .from("chat_invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single()

    if (error || !invitation) {
      throw new Error("Invalid or expired invitation")
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error("Invitation has expired")
    }

    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) {
      throw new Error("User must be authenticated")
    }

    // Add user as collaborator
    await supabase.from("chat_collaborators").insert({
      chat_id: invitation.chat_id,
      user_id: userId,
      role: invitation.role,
      permissions: invitation.permissions,
      invited_at: invitation.created_at,
      accepted_at: new Date().toISOString(),
      status: "active",
    })

    // Mark invitation as accepted
    await supabase.from("chat_invitations").update({ status: "accepted" }).eq("token", token)

    return invitation.chat_id
  }

  static async updateCollaboratorRole(
    chatId: string,
    userId: string,
    role: Collaborator["role"],
    permissions: Permission[]
  ) {
    const { error } = await supabase
      .from("chat_collaborators")
      .update({ role, permissions })
      .eq("chat_id", chatId)
      .eq("user_id", userId)

    if (error) throw error
  }

  static async removeCollaborator(chatId: string, userId: string) {
    const { error } = await supabase
      .from("chat_collaborators")
      .update({ status: "inactive" })
      .eq("chat_id", chatId)
      .eq("user_id", userId)

    if (error) throw error
  }

  static async getCollaborators(chatId: string): Promise<Collaborator[]> {
    const { data, error } = await supabase
      .from("chat_collaborators")
      .select(
        `
        *,
        user:users(id, email, name, avatar_url)
      `
      )
      .eq("chat_id", chatId)
      .eq("status", "active")

    if (error) throw error
    return data || []
  }

  static async checkPermission(chatId: string, userId: string, action: string, resource: string): Promise<boolean> {
    const { data: collaborator } = await supabase
      .from("chat_collaborators")
      .select("role, permissions")
      .eq("chat_id", chatId)
      .eq("user_id", userId)
      .eq("status", "active")
      .single()

    if (!collaborator) return false

    // Check role-based permissions
    const rolePermissions = this.getRolePermissions(collaborator.role)
    if (rolePermissions.includes(`${action}:${resource}`)) {
      return true
    }

    // Check explicit permissions
    return collaborator.permissions.some((p: Permission) => p.action === action && p.resource === resource && p.granted)
  }

  private static getRolePermissions(role: Collaborator["role"]): string[] {
    switch (role) {
      case "owner":
        return ["*:*"] // All permissions
      case "editor":
        return [
          "read:chat",
          "write:chat",
          "edit:chat",
          "read:message",
          "write:message",
          "edit:message",
          "delete:message",
          "read:attachment",
          "write:attachment",
        ]
      case "viewer":
        return ["read:chat", "read:message", "read:attachment"]
      case "commenter":
        return ["read:chat", "read:message", "read:attachment", "write:comment", "edit:comment", "delete:comment"]
      default:
        return []
    }
  }

  private static async sendInvitationEmail(email: string, token: string, chatId: string) {
    // Implementation for sending invitation email
    // This would integrate with your email service
    logger.info(`Sending invitation to ${email} with token ${token} for chat ${chatId}`, { component: "collaboration" })
  }

  static async startVideoCall(chatId: string, participants: string[]) {
    // Integration with video calling service (WebRTC, Agora, etc.)
    const callId = `call_${Date.now()}`

    await supabase.from("video_calls").insert({
      id: callId,
      chat_id: chatId,
      participants,
      started_by: (await supabase.auth.getUser()).data.user?.id,
      started_at: new Date().toISOString(),
      status: "active",
    })

    return callId
  }

  static async endVideoCall(callId: string) {
    await supabase
      .from("video_calls")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", callId)
  }
}
