"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const handleCallback = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Create profile after email confirmation
        const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", user.id).single()

        if (!existingProfile) {
          await supabase.from("profiles").insert({
            id: user.id,
            username: user.user_metadata.username || `user_${user.id.slice(0, 8)}`,
            display_name: user.user_metadata.display_name || "Anonymous User",
          })
        }

        router.push("/chat")
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <p className="text-muted-foreground">Confirming your account...</p>
    </div>
  )
}
