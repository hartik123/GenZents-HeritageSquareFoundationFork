import { create } from "zustand"
import { supabase } from "@/lib/supabase/client"
import type { User, Session } from "@supabase/supabase-js"

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
  updateProfile: (updates: { full_name?: string }) => Promise<{ error?: string }>
  resetPassword: (email: string) => Promise<{ error?: string }>
  updatePassword: (password: string) => Promise<{ error?: string }>
  resendConfirmation: (email: string) => Promise<{ error?: string }>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    try {
      set({ loading: true })

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        console.error("Error getting session:", error)
      }

      set({
        session,
        user: session?.user || null,
        loading: false,
        initialized: true,
      })

      supabase.auth.onAuthStateChange(async (event, session) => {
        set({
          session,
          user: session?.user || null,
          loading: false,
        })
      })
    } catch (error) {
      console.error("Error initializing auth:", error)
      set({ loading: false, initialized: true })
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true })

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        set({ loading: false })
        return { error: error.message }
      }

      set({
        user: data.user,
        session: data.session,
        loading: false,
      })

      return {}
    } catch (error) {
      set({ loading: false })
      return { error: "An unexpected error occurred" }
    }
  },

  signUp: async (email: string, password: string, metadata = {}) => {
    try {
      set({ loading: true })

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/confirm-account/{{.TokenHash}}?type=signup`,
        },
      })

      if (error) {
        set({ loading: false })
        return { error: error.message }
      }

      set({
        user: data.user,
        session: data.session,
        loading: false,
      })

      return {}
    } catch (error) {
      set({ loading: false })
      return { error: "An unexpected error occurred" }
    }
  },

  signOut: async () => {
    try {
      set({ loading: true })

      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Error signing out:", error)
      }

      set({
        user: null,
        session: null,
        loading: false,
      })
    } catch (error) {
      console.error("Error signing out:", error)
      set({ loading: false })
    }
  },

  updateProfile: async (updates: { full_name?: string }) => {
    try {
      set({ loading: true })

      const { data, error } = await supabase.auth.updateUser({
        data: updates,
      })

      if (error) {
        set({ loading: false })
        return { error: error.message }
      }

      set({
        user: data.user,
        loading: false,
      })

      return {}
    } catch (error) {
      set({ loading: false })
      return { error: "An unexpected error occurred" }
    }
  },

  resetPassword: async (email: string) => {
    try {
      set({ loading: true })

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/confirm-account/{{.TokenHash}}?type=recovery`,
      })

      if (error) {
        set({ loading: false })
        return { error: error.message }
      }

      set({ loading: false })

      return {}
    } catch (error) {
      set({ loading: false })
      return { error: "An unexpected error occurred" }
    }
  },

  updatePassword: async (password: string) => {
    try {
      set({ loading: true })

      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        set({ loading: false })
        return { error: error.message }
      }

      set({ loading: false })

      return {}
    } catch (error) {
      set({ loading: false })
      return { error: "An unexpected error occurred" }
    }
  },

  resendConfirmation: async (email: string) => {
    try {
      set({ loading: true })

      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm-account/{{.TokenHash}}?type=signup`,
        },
      })

      if (error) {
        set({ loading: false })
        return { error: error.message }
      }

      set({ loading: false })

      return {}
    } catch (error) {
      set({ loading: false })
      return { error: "An unexpected error occurred" }
    }
  },
}))
