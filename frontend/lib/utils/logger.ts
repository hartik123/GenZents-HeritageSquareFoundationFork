enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

interface LogContext {
  component?: string
  action?: string
  userId?: string
  [key: string]: any
}

class Logger {
  private isDev = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_NODE_ENV === "development"
  private isServer = typeof window === "undefined"

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` [${JSON.stringify(context)}]` : ""
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isServer) {
      // On server, be more permissive with logging for debugging
      return true // Log everything on server for now
    }
    // On client, log all levels in development, only ERROR in production
    return this.isDev || level === LogLevel.ERROR
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return

    const formattedMessage = this.formatMessage(LogLevel.ERROR, message, context)
    console.error(formattedMessage, error || "")
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return

    const formattedMessage = this.formatMessage(LogLevel.WARN, message, context)
    console.warn(formattedMessage)
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return

    const formattedMessage = this.formatMessage(LogLevel.INFO, message, context)
    console.info(formattedMessage)

    // Fallback: Also use regular console.log on server to ensure visibility
    if (this.isServer) {
      console.log(`[INFO] ${message}`, context || {})
    }
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return

    const formattedMessage = this.formatMessage(LogLevel.DEBUG, message, context)
    console.debug(formattedMessage)
  }

  // Server-specific logging methods for API routes
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API ${method} ${path}`, { ...context, type: "api_request" })
  }

  apiResponse(method: string, path: string, status: number, duration?: number, context?: LogContext): void {
    const level = status >= 400 ? LogLevel.ERROR : status >= 300 ? LogLevel.WARN : LogLevel.INFO
    const message = `API ${method} ${path} - ${status}${duration ? ` (${duration}ms)` : ""}`

    if (level === LogLevel.ERROR) {
      this.error(message, undefined, { ...context, type: "api_response", status, duration })
    } else if (level === LogLevel.WARN) {
      this.warn(message, { ...context, type: "api_response", status, duration })
    } else {
      this.info(message, { ...context, type: "api_response", status, duration })
    }
  }

  apiError(method: string, path: string, error: Error, context?: LogContext): void {
    this.error(`API ${method} ${path} failed`, error, { ...context, type: "api_error" })
  }

  database(action: string, table?: string, context?: LogContext): void {
    this.debug(`Database ${action}${table ? ` on ${table}` : ""}`, { ...context, type: "database" })
  }

  auth(action: string, userId?: string, context?: LogContext): void {
    this.info(`Auth ${action}`, { ...context, type: "auth", userId })
  }
}

export const logger = new Logger()

// Middleware helper for API routes
export function withLogging<T extends any[]>(
  handler: (...args: T) => Promise<Response> | Response,
  routeName?: string
) {
  return async (...args: T): Promise<Response> => {
    const request = args[0] as Request
    const method = request.method
    const url = new URL(request.url)
    const path = routeName || url.pathname
    const startTime = Date.now()

    logger.apiRequest(method, path)

    try {
      const response = await handler(...args)
      const duration = Date.now() - startTime
      logger.apiResponse(method, path, response.status, duration)
      return response
    } catch (error) {
      const duration = Date.now() - startTime
      logger.apiError(method, path, error as Error, { duration })
      throw error
    }
  }
}
