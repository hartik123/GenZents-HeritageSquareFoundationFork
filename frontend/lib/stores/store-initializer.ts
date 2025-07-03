import { useAuthStore } from "./auth-store"
import { useChatStore } from "./chat-store"
import { useTaskStore } from "./task-store"
import { logger } from "@/lib/utils/logger"

export interface StoreInitializer {
  initialize: () => Promise<void>
  cleanup?: () => void
}

class StoreManager {
  private initialized = false
  private stores: Map<string, StoreInitializer> = new Map()

  register(name: string, store: StoreInitializer) {
    this.stores.set(name, store)
  }

  async initializeAll(): Promise<void> {
    if (this.initialized) return

    try {
      logger.info("Initializing stores...")

      const initPromises = Array.from(this.stores.entries()).map(async ([name, store]) => {
        try {
          await store.initialize()
          logger.info(`Store ${name} initialized successfully`)
        } catch (error) {
          logger.error(`Failed to initialize store ${name}`, error as Error)
        }
      })

      await Promise.all(initPromises)
      this.initialized = true
      logger.info("All stores initialized")
    } catch (error) {
      logger.error("Failed to initialize stores", error as Error)
    }
  }

  cleanup() {
    this.stores.forEach((store, name) => {
      try {
        store.cleanup?.()
        logger.info(`Store ${name} cleaned up`)
      } catch (error) {
        logger.error(`Failed to cleanup store ${name}`, error as Error)
      }
    })
    this.initialized = false
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

export const storeManager = new StoreManager()

export const initializeStores = async (): Promise<void> => {
  const authStore = useAuthStore.getState()
  const chatStore = useChatStore.getState()
  const taskStore = useTaskStore.getState()

  storeManager.register("auth", {
    initialize: async () => {
      if (authStore.initialize) {
        await authStore.initialize()
      }
    },
  })

  storeManager.register("chat", {
    initialize: async () => {
      if (authStore.user && chatStore.loadChats) {
        await chatStore.loadChats()
      }
    },
  })

  storeManager.register("task", {
    initialize: async () => {
      if (authStore.user && taskStore.fetchTasks) {
        await taskStore.fetchTasks()
        if (taskStore.subscribeToTasks) {
          taskStore.subscribeToTasks()
        }
      }
    },
  })

  await storeManager.initializeAll()
}
