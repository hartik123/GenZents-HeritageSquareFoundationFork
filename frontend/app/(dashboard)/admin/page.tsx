"use client"

import { AuthGuard } from "@/components/auth/auth-guard"
import { AdminUserManagement } from "@/components/admin/user-management"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthStore } from "@/lib/stores/auth-store"
import { Users, Activity } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

export default function AdminPage() {
  const { profile } = useAuthStore()
  const [userCount, setUserCount] = useState(0)
  const [chatCount, setChatCount] = useState(0)
  const [messagesCount, setMessagesCount] = useState(0)
  const [user, setUser] = useState<User | null>(null)

  const countUsers =async () =>{
      const { count: userCount, error: chatError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true }) // only count

      if (!chatError) setUserCount(userCount || 0)
  }

  const countChats =async () =>{
      const { count: chatCount, error: chatError } = await supabase
        .from("chats")
        .select("*", { count: "exact", head: true }) // only count

      if (!chatError) setChatCount(chatCount || 0)
  }
const countMessages =async () =>{
      const { count: messagesCount, error: chatError } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true }) // only count

      if (!chatError) setMessagesCount(messagesCount || 0)
  }

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  useEffect(()=>{
    countUsers()
    countChats()
    countMessages()

  }, [user])

  return (
    <AuthGuard requireAdmin={true}>
      <div className="h-full overflow-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-xl text-muted-foreground">Welcome back, {profile?.full_name}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userCount}</div>
                <p className="text-xs text-muted-foreground">Active users</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">Total GEMINI API calls made</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Chats</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{chatCount}</div>
                <p className="text-xs text-muted-foreground">Total Number of Chats</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{messagesCount}</div>
                <p className="text-xs text-muted-foreground">Total Number of Messages</p>
              </CardContent>
            </Card>
          </div>

          <AdminUserManagement />
        </div>
      </div>
    </AuthGuard>
  )
}
