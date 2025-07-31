"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Plus, LogOut, MoreHorizontal, User, GitBranch, ChartNoAxesCombined, Shield, Activity } from "lucide-react"
import { useChatStore } from "@/lib/stores/chat-store"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useTaskStore } from "@/lib/stores/task-store"
import { useToast } from "@/hooks/use-toast"


const NAVIGATION_ITEMS = [
  { title: "Tasks", url: "/tasks", icon: Activity, permission: "read" },
  { title: "Version", url: "/version", icon: GitBranch, permission: "read" },
] as const


export function AppSidebar() {
  const router = useRouter()
  const { toast } = useToast()
  const { chats, createChat, selectChat, deleteChat, loadChats, currentChatId, clearAll: clearChats } = useChatStore()
  const { user, profile, signOut, isAdmin, hasPermission, loading } = useAuthStore()
  const { clearAll: clearTasks } = useTaskStore()

  useEffect(() => {
    loadChats()
  }, [loadChats])

  const handleDeleteChat = async (chatId: string) => {
    await deleteChat(chatId)
    if (currentChatId === chatId) {
      router.push("/")
    }
  }

  const handleNewChat = async () => {
    const chatId = await createChat()
    router.push(`/chat/${chatId}`)
  }

  const handleSelectChat = (chatId: string) => {
    selectChat(chatId)
    router.push(`/chat/${chatId}`)
  }

  const handleSignOut = async () => {
    try {
      // Clear all user-specific data
      clearChats()
      clearTasks()

      await signOut()

      // Use router.replace for better UX
      router.replace("/auth")

      // Fallback to window.location if router fails
      setTimeout(() => {
        if (window.location.pathname !== "/auth") {
          window.location.href = "/auth"
        }
      }, 100)
    } catch (error) {
      console.error("Sign out failed:", error)
      // Still redirect to auth even if sign out fails
      router.replace("/auth")
      setTimeout(() => {
        if (window.location.pathname !== "/auth") {
          window.location.href = "/auth"
        }
      }, 100)
    }
  }

  const navigationItems = NAVIGATION_ITEMS.filter((item) => hasPermission(item.permission as any))

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center justify-between p-2">
          <a
            href="/"
            className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
            onClick={(e) => {
              e.preventDefault()
              router.push("/")
            }}
          >
            Archyx AI
          </a>
          <div className="flex items-center gap-1">
            <Button onClick={handleNewChat} size="sm" variant="ghost">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col overflow-hidden">
        <SidebarGroup className="flex-1 min-h-0">
          <SidebarGroupLabel>Recent Chats</SidebarGroupLabel>
          <SidebarGroupContent className="flex-1 overflow-auto">
            <SidebarMenu>
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton asChild isActive={currentChatId === chat.id}>
                    <a
                      href={`/chat/${chat.id}`}
                      className="w-full text-left"
                      onClick={(e) => {
                        e.preventDefault()
                        handleSelectChat(chat.id)
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="truncate">{chat.title}</span>
                    </a>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction>
                        <MoreHorizontal className="h-4 w-4" />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>{" "}
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleDeleteChat(chat.id)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6 flex-shrink-0">
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a
                      href={item.url}
                      className="w-full text-left"
                      onClick={(e) => {
                        e.preventDefault()
                        router.push(item.url)
                      }}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a
                    href="#sync"
                    className="w-full text-left"
                    onClick={async (e) => {
                      e.preventDefault()
                      toast({ title: "Syncing Drive..." })
                      try {
                        const res = await fetch("/api/sync", { method: "POST" })
                        if (!res.ok) throw new Error("Sync failed")
                        const data = await res.json()
                        toast({ title: "Drive Synced", description: data.status || "Success" })
                      } catch (err) {
                        toast({ title: "Sync failed", description: (err as Error).message, variant: "destructive" })
                      }
                    }}
                  >
                    <ChartNoAxesCombined className="h-4 w-4" />
                    <span>Sync Drive</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate text-sm">{profile?.full_name || user?.email}</span>
                    {isAdmin() && (
                      <Badge variant="outline" className="text-xs w-fit">
                        Admin
                      </Badge>
                    )}
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
                <DropdownMenuItem onClick={() => router.push("/account")}>
                  <User className="h-4 w-4 mr-2" />
                  Account
                </DropdownMenuItem>
                {isAdmin() && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/admin")}>
                      <Shield className="h-4 w-4 mr-2" />
                      Admin Panel
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} disabled={loading}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {loading ? "Signing out..." : "Sign Out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
