"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

export default function ConfirmAccountPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<"loading" | "confirmed" | "error">("loading")
  const [message, setMessage] = useState("")
  const [countdown, setCountdown] = useState(3)

  const token = params.id as string
  const type = searchParams.get("type") || "signup"

  useEffect(() => {
    const confirmAccount = async () => {
      if (!token) {
        setStatus("error")
        setMessage("Invalid confirmation link")
        return
      }

      try {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type === "recovery" ? "recovery" : "signup",
        })

        if (error) {
          throw error
        }
        setStatus("confirmed")

        if (type === "recovery") {
          setMessage("Email verified! You can now reset your password.")
          // For recovery, we don't redirect automatically since the user needs to
          // access the reset form while their session is still valid
        } else {
          setMessage("Your account has been confirmed successfully! You can now start using drAIve.")
          // Start countdown for redirect
          const timer = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(timer)
                router.push("/auth")
                return 0
              }
              return prev - 1
            })
          }, 1000)
        }
      } catch (error: any) {
        console.error("Confirmation error:", error)
        setStatus("error")

        if (error.message?.includes("Token has expired")) {
          setMessage("This confirmation link has expired. Please request a new one.")
        } else if (error.message?.includes("Invalid token")) {
          setMessage("This confirmation link is invalid. Please check your email for the correct link.")
        } else {
          setMessage("An error occurred during confirmation. Please try again or contact support.")
        }
      }
    }

    confirmAccount()
  }, [token, type, router])

  const handleResendConfirmation = () => {
    router.push("/auth?resend=true")
  }

  const handleResetPassword = () => {
    router.push("/auth/reset-password")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {status === "loading" && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
              {status === "confirmed" && <CheckCircle className="h-12 w-12 text-green-600" />}
              {status === "error" && <XCircle className="h-12 w-12 text-red-600" />}
            </div>

            <CardTitle className="text-2xl">
              {status === "loading" && "Confirming..."}
              {status === "confirmed" && "Confirmed!"}
              {status === "error" && "Confirmation Failed"}
            </CardTitle>

            <CardDescription>
              {status === "loading" && "Please wait while we verify your email"}
              {status === "confirmed" && (type === "recovery" ? "Email verified successfully" : "Welcome to drAIve")}
              {status === "error" && "There was an issue with your confirmation link"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {message && (
              <Alert
                className={
                  status === "confirmed"
                    ? "bg-green-50 text-green-800 border-green-200"
                    : status === "error"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : ""
                }
              >
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}{" "}
            {status === "confirmed" && type === "recovery" && (
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Your email has been verified. You can now proceed to reset your password.
                </p>
                <Button onClick={() => router.push("/auth/reset-password")} className="w-full">
                  Reset Password
                </Button>
              </div>
            )}
            {status === "confirmed" && type !== "recovery" && (
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  You will be redirected to the sign in page in {countdown} seconds...
                </p>
                <Button onClick={() => router.push("/auth")} className="w-full">
                  Continue to Sign In
                </Button>
              </div>
            )}
            {status === "error" && (
              <div className="flex flex-col space-y-2">
                {type === "recovery" ? (
                  <Button onClick={handleResetPassword} className="w-full">
                    Request New Reset Link
                  </Button>
                ) : (
                  <Button onClick={handleResendConfirmation} variant="outline" className="w-full">
                    Resend Confirmation Email
                  </Button>
                )}

                <Button onClick={() => router.push("/auth")} variant="outline" className="w-full">
                  Back to Sign In
                </Button>
              </div>
            )}
            {status === "loading" && (
              <div className="text-center text-sm text-muted-foreground">This may take a few moments...</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
