"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
          ? `${process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL}/auth/reset-password`
          : `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setSuccess(true)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>Enter your email address and we&apos;ll send you a password reset link</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-300">
                  Check your email for a password reset link. If you don&apos;t see it, check your spam folder.
                </p>
                <Button asChild className="w-full transition-all duration-200 active:scale-95">
                  <Link href="/auth/login">Back to Sign In</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetRequest}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="transition-all duration-200 focus-visible:scale-[1.01]"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-300">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full transition-all duration-200 active:scale-95"
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  Remember your password?{" "}
                  <Link
                    href="/auth/login"
                    className="underline underline-offset-4 transition-colors hover:text-primary"
                  >
                    Sign in
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
