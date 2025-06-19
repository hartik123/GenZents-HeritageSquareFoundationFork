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
import { useChat } from "@/hooks/chat-provider"
import { SettingsDialog } from "@/components/settings/settings-dialog"

export function Header() {
  const { currentSession } = useChat()

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink href="/">Archyx AI</BreadcrumbLink>
          </BreadcrumbItem>
          {currentSession && (
            <>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="max-w-[200px] truncate">{currentSession.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
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
