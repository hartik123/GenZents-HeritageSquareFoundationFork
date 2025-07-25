"use client"

import { AuthGuard } from "@/components/auth/auth-guard"
import { AdminUserManagement } from "@/components/admin/user-management"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthStore } from "@/lib/stores/auth-store"
import { Users, Activity } from "lucide-react"

export default function AdminPage() {
  const { profile } = useAuthStore()

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
                <div className="text-2xl font-bold">0</div>
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
          </div>

          <AdminUserManagement />
        </div>
      </div>
    </AuthGuard>
  )
}
