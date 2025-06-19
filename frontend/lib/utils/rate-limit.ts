interface RateLimitOptions {
  windowMs: number
  max: number
  message: string
  standardHeaders: boolean
  legacyHeaders: boolean
}

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export const rateLimit = (options: RateLimitOptions) => {
  return (identifier: string): { allowed: boolean; remaining: number; resetTime: number } => {
    const now = Date.now()
    const key = identifier

    // Clean up expired entries
    if (store[key] && now > store[key].resetTime) {
      delete store[key]
    }

    // Initialize or get current count
    if (!store[key]) {
      store[key] = {
        count: 0,
        resetTime: now + options.windowMs,
      }
    }

    store[key].count++

    const allowed = store[key].count <= options.max
    const remaining = Math.max(0, options.max - store[key].count)

    return {
      allowed,
      remaining,
      resetTime: store[key].resetTime,
    }
  }
}

// Usage example:
// const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: "Too many requests", standardHeaders: true, legacyHeaders: false })
// const result = limiter(userIP)
