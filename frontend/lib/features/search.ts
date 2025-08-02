import { supabase } from "@/lib/supabase/client"
import type { SearchOptions } from "@/lib/types"

export class AdvancedSearch {
  static async search(options: SearchOptions): Promise<any> {
    const { query, filters, sortBy = "relevance", sortOrder = "desc" } = options

    let chatQuery = supabase.from("chats").select("*")
    let messageQuery = supabase.from("messages").select("*")

    if (query) {
      chatQuery = chatQuery.ilike("title", `%${query}%`)
      messageQuery = messageQuery.ilike("content", `%${query}%`)
    }

    if (filters.dateRange) {
      const [start, end] = filters.dateRange
      chatQuery = chatQuery.gte("created_at", start).lte("created_at", end)
      messageQuery = messageQuery.gte("created_at", start).lte("created_at", end)
    }

    if (filters.users?.length) {
      chatQuery = chatQuery.in("user_id", filters.users)
      messageQuery = messageQuery.in("user_id", filters.users)
    }

    const sortColumn = this.getSortColumn(sortBy)
    chatQuery = chatQuery.order(sortColumn, { ascending: sortOrder === "asc" })
    messageQuery = messageQuery.order(sortColumn, { ascending: sortOrder === "asc" })

    const [chatResult, messageResult] = await Promise.all([chatQuery, messageQuery])

    return chatResult.data || []
  }

  private static getSortColumn(sortBy: string): string {
    switch (sortBy) {
      case "date":
        return "created_at"
      case "tokens":
        return "created_at" // Fallback since tokens field doesn't exist in simplified schema
      default:
        return "created_at"
    }
  }
}
