export interface AIModel {
  id: string
  name: string
  provider: string
  type: "text" | "image" | "audio" | "video" | "multimodal"
  capabilities: ModelCapability[]
  pricing: ModelPricing
  limits: ModelLimits
  status: "active" | "deprecated" | "beta"
  description: string
}

export interface ModelCapability {
  name: string
  supported: boolean
  quality: "low" | "medium" | "high" | "excellent"
}

export interface ModelPricing {
  input_cost: number
  output_cost: number
  currency: string
  unit: string
}

export interface ModelLimits {
  max_tokens: number
  max_requests_per_minute: number
  max_requests_per_day: number
  context_window: number
}

export interface Plugin {
  id: string
  name: string
  description: string
  version: string
  author: string
  category: string
  permissions: string[]
  settings: PluginSettings
  enabled: boolean
  installed_at: string
}

export interface PluginSettings {
  [key: string]: any
}
