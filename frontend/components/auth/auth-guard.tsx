"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuthStore } from "@/lib/stores/auth-store"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, initialized, initialize } = useAuthStore()

  useEffect(() => {
    if (!initialized) {
      initialize()
    }
  }, [initialized, initialize])

  useEffect(() => {
    if (initialized && !loading) {
      const isAuthPage = pathname === "/auth" || pathname === "/reset-password"

      if (!user && !isAuthPage) {
        // Redirect to auth page if not authenticated
        router.push("/auth")
      } else if (user && isAuthPage) {
        // Redirect to home if already authenticated
        router.push("/")
      }
    }
  }, [user, loading, initialized, pathname, router])

  // Show nothing while checking authentication
  if (loading || !initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Auth pages are handled by their own components
  if (pathname === "/auth" || pathname === "/reset-password") {
    return <>{children}</>
  }

  // Protected routes
  return user ? <>{children}</> : null
}
