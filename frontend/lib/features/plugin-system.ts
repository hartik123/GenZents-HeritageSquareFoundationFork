import { supabase } from "@/lib/supabase/client"
import type { Plugin, PluginSettings } from "@/lib/types"

export interface PluginAPI {
  // Core API methods available to plugins
  sendMessage: (content: string, options?: any) => Promise<void>
  getCurrentChat: () => any
  getUser: () => any
  showNotification: (message: string, type?: "info" | "success" | "warning" | "error") => void
  registerCommand: (name: string, handler: Function) => void
  registerShortcut: (keys: string[], handler: Function) => void
  addMenuItem: (menu: string, item: any) => void
  storage: {
    get: (key: string) => Promise<any>
    set: (key: string, value: any) => Promise<void>
    remove: (key: string) => Promise<void>
  }
}

export class PluginSystem {
  private static plugins: Map<string, Plugin> = new Map()
  private static loadedPlugins: Map<string, any> = new Map()
  private static api: PluginAPI

  static initialize(api: PluginAPI) {
    this.api = api
  }

  static async loadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    try {
      // Load plugin code (in a real implementation, this would be sandboxed)
      const pluginModule = await this.loadPluginCode(plugin)

      // Initialize plugin with API
      if (pluginModule.initialize) {
        await pluginModule.initialize(this.api, plugin.settings)
      }

      this.loadedPlugins.set(pluginId, pluginModule)

      // Update plugin status
      await supabase
        .from("user_plugins")
        .update({ enabled: true })
        .eq("plugin_id", pluginId)
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
    } catch (error) {
      console.error(`Failed to load plugin ${pluginId}:`, error)
      throw error
    }
  }

  static async unloadPlugin(pluginId: string): Promise<void> {
    const pluginModule = this.loadedPlugins.get(pluginId)
    if (pluginModule && pluginModule.cleanup) {
      await pluginModule.cleanup()
    }

    this.loadedPlugins.delete(pluginId)

    // Update plugin status
    await supabase
      .from("user_plugins")
      .update({ enabled: false })
      .eq("plugin_id", pluginId)
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
  }

  static async installPlugin(plugin: Plugin): Promise<void> {
    // Validate plugin
    this.validatePlugin(plugin)

    // Store plugin
    const { error } = await supabase.from("plugins").insert(plugin)

    if (error) {
      throw new Error(`Failed to install plugin: ${error.message}`)
    }

    this.plugins.set(plugin.id, plugin)

    // Add to user's plugins
    await supabase.from("user_plugins").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      plugin_id: plugin.id,
      settings: plugin.settings,
      enabled: false,
    })
  }

  static async uninstallPlugin(pluginId: string): Promise<void> {
    // Unload if currently loaded
    if (this.loadedPlugins.has(pluginId)) {
      await this.unloadPlugin(pluginId)
    }

    // Remove from user's plugins
    await supabase
      .from("user_plugins")
      .delete()
      .eq("plugin_id", pluginId)
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)

    this.plugins.delete(pluginId)
  }

  static async updatePluginSettings(pluginId: string, settings: PluginSettings): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    // Update settings in database
    await supabase
      .from("user_plugins")
      .update({ settings })
      .eq("plugin_id", pluginId)
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)

    // Update plugin settings
    plugin.settings = settings

    // Reload plugin if it's currently loaded
    if (this.loadedPlugins.has(pluginId)) {
      await this.unloadPlugin(pluginId)
      await this.loadPlugin(pluginId)
    }
  }

  static async getAvailablePlugins(): Promise<Plugin[]> {
    const { data, error } = await supabase.from("plugins").select("*").order("name")

    if (error) {
      throw new Error(`Failed to get plugins: ${error.message}`)
    }

    return data || []
  }

  static async getUserPlugins(): Promise<Plugin[]> {
    const { data, error } = await supabase
      .from("user_plugins")
      .select(
        `
        *,
        plugin:plugins(*)
      `
      )
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)

    if (error) {
      throw new Error(`Failed to get user plugins: ${error.message}`)
    }

    return data?.map((up) => up.plugin) || []
  }

  private static validatePlugin(plugin: Plugin): void {
    if (!plugin.id || !plugin.name || !plugin.version) {
      throw new Error("Plugin must have id, name, and version")
    }

    if (!plugin.permissions || !Array.isArray(plugin.permissions)) {
      throw new Error("Plugin must declare permissions")
    }

    // Additional validation rules
    const requiredFields = ["description", "author", "category"]
    for (const field of requiredFields) {
      if (!plugin[field as keyof Plugin]) {
        throw new Error(`Plugin must have ${field}`)
      }
    }
  }

  private static async loadPluginCode(plugin: Plugin): Promise<any> {
    // In a real implementation, this would:
    // 1. Download plugin code from a secure source
    // 2. Validate code signature
    // 3. Load in a sandboxed environment
    // 4. Apply security restrictions based on permissions

    // For now, return a mock plugin module
    return {
      initialize: async (api: PluginAPI, settings: PluginSettings) => {
        console.log(`Initializing plugin ${plugin.name}`)
      },
      cleanup: async () => {
        console.log(`Cleaning up plugin ${plugin.name}`)
      },
    }
  }

  static executePluginCommand(pluginId: string, command: string, args: any[]): Promise<any> {
    const pluginModule = this.loadedPlugins.get(pluginId)
    if (!pluginModule) {
      throw new Error(`Plugin ${pluginId} is not loaded`)
    }

    if (!pluginModule.commands || !pluginModule.commands[command]) {
      throw new Error(`Command ${command} not found in plugin ${pluginId}`)
    }

    return pluginModule.commands[command](...args)
  }

  static async createPluginStore(pluginId: string) {
    return {
      get: async (key: string) => {
        const { data } = await supabase
          .from("plugin_storage")
          .select("value")
          .eq("plugin_id", pluginId)
          .eq("key", key)
          .single()

        return data?.value
      },
      set: async (key: string, value: any) => {
        await supabase.from("plugin_storage").upsert({
          plugin_id: pluginId,
          key,
          value,
          updated_at: new Date().toISOString(),
        })
      },
      remove: async (key: string) => {
        await supabase.from("plugin_storage").delete().eq("plugin_id", pluginId).eq("key", key)
      },
    }
  }
}
