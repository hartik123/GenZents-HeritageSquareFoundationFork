"use client"

import * as React from "react"
import { MessageSquare, Search, Star, Trash2, MoreHorizontal } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useChatStore } from "@/lib/stores/chat-store"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

export function ChatHistory() {
  const { chats, currentChatId, selectChat, deleteChat, updateChat } = useChatStore()
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredChats = React.useMemo(() => {
    if (!searchQuery) return chats
    return chats.filter((chat) => chat.title.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [chats, searchQuery])

  const handleSelectChat = (chatId: string) => {
    selectChat(chatId)
  }

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteChat(chatId)
  }

  const handleBookmarkChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const chat = chats.find((c) => c.id === chatId)
    if (chat) {
      await updateChat(chatId, { bookmarked: !chat.bookmarked })
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Chat History</SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="mb-2">
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>

        <SidebarMenu>
          {filteredChats.map((chat) => (
            <SidebarMenuItem key={chat.id}>
              <SidebarMenuButton
                onClick={() => handleSelectChat(chat.id)}
                className={cn("w-full justify-start", currentChatId === chat.id && "bg-sidebar-accent")}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{chat.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(chat.created_at, { addSuffix: true })}
                  </div>
                </div>
                {chat.bookmarked && <Star className="h-3 w-3 fill-current text-yellow-500" />}
              </SidebarMenuButton>

              <SidebarMenuAction>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="cursor-pointer p-1 hover:bg-sidebar-accent rounded">
                      <MoreHorizontal className="h-4 w-4" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => handleBookmarkChat(chat.id, e)}>
                      <Star className="h-4 w-4 mr-2" />
                      {chat.bookmarked ? "Remove Bookmark" : "Bookmark"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => handleDeleteChat(chat.id, e)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuAction>
            </SidebarMenuItem>
          ))}

          {filteredChats.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">
              {searchQuery ? "No matching chats found" : "No chats yet"}
            </div>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
