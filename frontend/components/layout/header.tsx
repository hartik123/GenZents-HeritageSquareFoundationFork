"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Settings, Search, Bell, HelpCircle } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { SettingsDialog } from "@/components/settings/settings-dialog"
import { usePathname } from "next/navigation"
import { useChatStore } from "@/lib/stores/chat-store"

import { MoreHorizontal, Edit, Bookmark, Share, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"

export function Header() {
  const pathname = usePathname()
  const { getCurrentChat, updateChat, deleteChat } = useChatStore()
  const chatTitleInputRef = useRef<HTMLInputElement>(null)
   const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState("")
  const router = useRouter()

  const currentChat = getCurrentChat()

   useEffect(() => {
    if (isEditing && chatTitleInputRef.current) {
      chatTitleInputRef.current.focus()
    }
  }, [isEditing])

  const getPageTitle = () => {
    if (pathname === "/") {
      return "Archyx AI"
    }

    if (pathname.startsWith("/chat/")) {
      const currentChat = getCurrentChat()
      return currentChat?.title || "Chat"
    }

    switch (pathname) {
      case "/version":
        return "Version"
      case "/admin":
        return "Admin"
      case "/account":
        return "Account"
      default:
        // For any other paths, capitalize the first segment
        const segments = pathname.split("/").filter(Boolean)
        return segments.length > 0 ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1) : "Archyx AI"
    }
  }

 

  if (!currentChat) return null

  const handleEditTitle = () => {
    chatTitleInputRef.current?.focus()
    setTitle(currentChat.title)
    setIsEditing(true)
  }

  const handleSaveTitle = async () => {
    if (title.trim()) {
      await updateChat(currentChat.id, { title: title.trim() })
    }
    setIsEditing(false)
  }

  const handleBookmark = async () => {
    await updateChat(currentChat.id, { bookmarked: !currentChat.bookmarked })
  }

  const handleDelete = async () => {
    await deleteChat(currentChat.id)
    router.push("/")
  }

  const getSettingsButton = () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleEditTitle}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Title
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleBookmark}>
            <Bookmark className={`h-4 w-4 mr-2 ${currentChat.bookmarked ? "fill-current" : ""}`} />
            {currentChat.bookmarked ? "Remove Bookmark" : "Bookmark"}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Share className="h-4 w-4 mr-2" />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

 

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block" onClick={handleEditTitle}>
            {isEditing ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
                className="text-base font-semibold"
                ref={chatTitleInputRef}
              />
            ) : (
              <h1 className="text-base truncate">{currentChat.title}</h1>
            )}

          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        {getSettingsButton()}
        <SettingsDialog>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </SettingsDialog>

        <ThemeToggle />
      </div>
    </header>
  )
}
