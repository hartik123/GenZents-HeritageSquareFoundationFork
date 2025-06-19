import DOMPurify from "isomorphic-dompurify"
import { rateLimit } from "./rate-limit"
import type { PasswordValidationResult } from "@/lib/types"

// Input validation and sanitization
export const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long")
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number")
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character")
  }

  return { valid: errors.length === 0, errors }
}

// XSS Protection
export const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// CSRF Protection
export const generateCSRFToken = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export const validateCSRFToken = (token: string, storedToken: string): boolean => {
  return token === storedToken
}

// Content Security Policy
export const getCSPHeader = (): string => {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://*.supabase.co",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ")
}

// Rate limiting
export const createRateLimiter = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    message: "Too many requests, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  })
}

// File upload security
export const validateFileUpload = (file: File): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = [
    "text/plain",
    "text/markdown",
    "application/json",
    "text/csv",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
  ]

  if (file.size > maxSize) {
    errors.push(`File size must be less than ${maxSize / 1024 / 1024}MB`)
  }

  if (!allowedTypes.includes(file.type)) {
    errors.push("File type not allowed")
  }

  // Check for malicious file extensions
  const dangerousExtensions = [".exe", ".bat", ".cmd", ".scr", ".pif", ".com"]
  const fileName = file.name.toLowerCase()

  if (dangerousExtensions.some((ext) => fileName.endsWith(ext))) {
    errors.push("File extension not allowed")
  }

  return { valid: errors.length === 0, errors }
}

// Encryption utilities (placeholder for future implementation)
export const encryptMessage = async (message: string, key: string): Promise<string> => {
  // Placeholder for message encryption
  // In production, use Web Crypto API or a proper encryption library
  return btoa(message) // Simple base64 encoding for demo
}

export const decryptMessage = async (encryptedMessage: string, key: string): Promise<string> => {
  // Placeholder for message decryption
  try {
    return atob(encryptedMessage) // Simple base64 decoding for demo
  } catch {
    throw new Error("Failed to decrypt message")
  }
}
