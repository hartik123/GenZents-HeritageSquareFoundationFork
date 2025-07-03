import { supabase } from "@/lib/supabase/client"
import type { Database } from "@/lib/types/database"
import type { VirusScanResult } from "@/lib/types/chat"

type Attachment = Database["public"]["Tables"]["attachments"]["Row"]
type AttachmentInsert = Database["public"]["Tables"]["attachments"]["Insert"]

export class FileManager {
  private static readonly DEFAULT_MAX_SIZE = 100 * 1024 * 1024 // 100MB
  private static readonly DEFAULT_ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/json",
    "text/csv",
    "audio/mpeg",
    "audio/wav",
    "video/mp4",
    "video/webm",
  ]

  static async uploadFile(file: File, chatId?: string, messageId?: string): Promise<Attachment> {
    this.validateFile(file, this.DEFAULT_MAX_SIZE, this.DEFAULT_ALLOWED_TYPES)

    const fileExtension = file.name.split(".").pop() || "bin"
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExtension}`
    const filePath = `attachments/${fileName}`

    const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath)

    let virusScanResult: VirusScanResult = {
      scanned: false,
      clean: true,
      scanned_at: new Date().toISOString(),
    }

    virusScanResult = await this.performVirusScan(file)
    if (!virusScanResult.clean) {
      await supabase.storage.from("attachments").remove([filePath])
      throw new Error("File failed virus scan")
    }

    const checksum = await this.calculateChecksum(file)

    const attachment: AttachmentInsert = {
      message_id: messageId || null,
      chat_id: chatId || null,
      name: file.name,
      type: file.type,
      size: file.size,
      content: urlData.publicUrl,
      checksum,
      scanned: virusScanResult.scanned,
      clean: virusScanResult.clean,
      threats: virusScanResult.threats || [],
      scanned_at: virusScanResult.scanned_at,
    }

    const { data: attachmentData, error: attachmentError } = await supabase
      .from("attachments")
      .insert(attachment)
      .select()
      .single()

    if (attachmentError) {
      throw new Error(`Failed to create attachment record: ${attachmentError.message}`)
    }

    return attachmentData
  }

  static async deleteFile(attachmentId: string): Promise<void> {
    const { data: attachment, error: fetchError } = await supabase
      .from("attachments")
      .select("content")
      .eq("id", attachmentId)
      .single()

    if (fetchError || !attachment) {
      throw new Error("Attachment not found")
    }

    if (attachment.content) {
      try {
        const url = new URL(attachment.content)
        const filePath = url.pathname.split("/").slice(-1)[0]
        await supabase.storage.from("attachments").remove([`attachments/${filePath}`])
      } catch (error) {
        console.warn("Failed to delete file from storage:", error)
      }
    }

    const { error: deleteError } = await supabase.from("attachments").delete().eq("id", attachmentId)

    if (deleteError) {
      throw new Error(`Failed to delete attachment record: ${deleteError.message}`)
    }
  }

  static async getAttachment(attachmentId: string): Promise<Attachment | null> {
    const { data, error } = await supabase.from("attachments").select("*").eq("id", attachmentId).single()

    if (error) return null
    return data
  }

  static async getAttachmentsByChat(chatId: string): Promise<Attachment[]> {
    const { data, error } = await supabase
      .from("attachments")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })

    if (error) return []
    return data || []
  }

  static async getAttachmentsByMessage(messageId: string): Promise<Attachment[]> {
    const { data, error } = await supabase
      .from("attachments")
      .select("*")
      .eq("message_id", messageId)
      .order("created_at", { ascending: false })

    if (error) return []
    return data || []
  }

  private static validateFile(file: File, maxSize: number, allowedTypes: string[]): void {
    if (file.size > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`)
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`)
    }
  }

  private static async performVirusScan(file: File): Promise<VirusScanResult> {
    // Mock implementation - replace with actual virus scanning service
    return {
      scanned: true,
      clean: true,
      scanned_at: new Date().toISOString(),
    }
  }

  private static async calculateChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  }
}
