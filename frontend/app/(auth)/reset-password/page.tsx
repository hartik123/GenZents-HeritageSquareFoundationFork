"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth-store"
import { supabase } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { resetPassword, updatePassword, loading } = useAuthStore()

  const [step, setStep] = useState<"request" | "reset">("request")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  // Check for session-based verification instead of URL params
  useEffect(() => {
    const checkSession = async () => {
      setIsVerifying(true)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        // Only allow password reset if user has a valid recovery session
        if (session?.user && session.user.recovery_sent_at) {
          setStep("reset")
        }
      } catch (error) {
        console.error("Session check error:", error)
      } finally {
        setIsVerifying(false)
      }
    }

    checkSession()
  }, [])
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    const result = await resetPassword(email)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess("Password reset email sent! Please check your inbox and follow the instructions.")
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long")
      return
    }

    try {
      // Verify we still have a valid recovery session
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user || !session.user.recovery_sent_at) {
        setError("Your password reset session has expired. Please request a new reset link.")
        setStep("request")
        return
      }

      const result = await updatePassword(password)

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess("Password updated successfully! Redirecting to sign in...")
        setTimeout(() => {
          router.push("/auth")
        }, 2000)
      }
    } catch (error) {
      console.error("Password reset error:", error)
      setError("An error occurred while resetting your password. Please try again.")
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">drAIve</h1>
          <p className="text-sm text-muted-foreground">
            {step === "request" ? "Reset your password" : "Create new password"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{step === "request" ? "Forgot Password?" : "Create New Password"}</CardTitle>
            <CardDescription>
              {step === "request"
                ? "Enter your email address and we'll send you a link to reset your password."
                : "Enter your new password below."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {step === "request" ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="bg-green-50 text-green-800 border-green-200">
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-col space-y-3">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Link
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push("/auth")}
                    disabled={loading}
                  >
                    Back to Sign In
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="bg-green-50 text-green-800 border-green-200">
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
