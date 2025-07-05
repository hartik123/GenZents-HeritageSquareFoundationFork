"use client"

import type React from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useStoreProvider } from "@/hooks/store-provider"
import { Loader2 } from "lucide-react"
import type { UserPermission } from "@/lib/types/user"

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireAdmin?: boolean
  requiredPermissions?: UserPermission[]
  fallback?: React.ReactNode
}

export function AuthGuard({
  children,
  requireAuth = true,
  requireAdmin = false,
  requiredPermissions = [],
  fallback,
}: AuthGuardProps): React.ReactElement | null {
  const router = useRouter()
  const { user, profile, loading, initialized, isAdmin, hasPermission } = useAuthStore()
  const storeProvider = useStoreProvider()

  useEffect(() => {
    if (!initialized || loading || !storeProvider.isInitialized) return
    if (requireAuth && !user) {
      router.replace("/auth")
      return
    }
    if (requireAdmin && !isAdmin()) {
      router.replace("/")
      return
    }
    if (requiredPermissions.length > 0) {
      const hasAllPermissions = requiredPermissions.every((permission) => hasPermission(permission))
      if (!hasAllPermissions) {
        router.replace("/")
        return
      }
    }
  }, [
    user,
    profile,
    initialized,
    loading,
    storeProvider.isInitialized,
    requireAuth,
    requireAdmin,
    requiredPermissions,
    router,
    isAdmin,
    hasPermission,
  ])

  if (!initialized || loading || storeProvider.isInitializing || !storeProvider.isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (storeProvider.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Store initialization failed: {storeProvider.error}</div>
      </div>
    )
  }

  // TODO: Using <></> instead of fallback||null . Fix later

  if (requireAuth && !user) {
    return <></>
  }

  if (requireAdmin && !isAdmin()) {
    return <></>
  }

  if (requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every((permission) => hasPermission(permission))

    if (!hasAllPermissions) {
      return <></>
    }
  }

  return <>{children}</>
}
