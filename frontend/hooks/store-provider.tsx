"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { initializeStores, storeManager } from "@/lib/stores/store-initializer"
import { logger } from "@/lib/utils/logger"
import { useAuthStore } from "@/lib/stores/auth-store"

interface StoreProviderState {
  isInitialized: boolean
  isInitializing: boolean
  error: string | null
}

const StoreProviderContext = createContext<StoreProviderState>({
  isInitialized: false,
  isInitializing: false,
  error: null,
})

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreProviderState>({
    isInitialized: false,
    isInitializing: false,
    error: null,
  })

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      if (state.isInitialized || state.isInitializing) return

      setState((prev) => ({ ...prev, isInitializing: true, error: null }))

      try {
        await initializeStores()

        if (mounted) {
          setState({
            isInitialized: true,
            isInitializing: false,
            error: null,
          })
        }
      } catch (error) {
        logger.error("Store initialization failed", error as Error)

        if (mounted) {
          setState({
            isInitialized: false,
            isInitializing: false,
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }
    }

    initialize()

    return () => {
      mounted = false
      storeManager.cleanup()
    }
  }, [])

  return <StoreProviderContext.Provider value={state}>{children}</StoreProviderContext.Provider>
}

export const useStoreProvider = () => {
  const context = useContext(StoreProviderContext)
  if (!context) {
    throw new Error("useStoreProvider must be used within a StoreProvider")
  }
  return context
}

export function useStoresReady() {
  const { initialized: authInitialized, loading: authLoading } = useAuthStore()
  const { isInitialized: storesInitialized, isInitializing, error } = useStoreProvider()

  const isReady = authInitialized && !authLoading && storesInitialized && !isInitializing
  const isLoading = !authInitialized || authLoading || isInitializing || !storesInitialized

  return {
    isReady,
    isLoading,
    error,
    authInitialized,
    storesInitialized,
    isInitializing,
  }
}
