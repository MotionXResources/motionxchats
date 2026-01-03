import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { FeedContent } from "@/components/feed-content"

export default async function FeedPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Ensure profile exists
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()

  if (!profile) {
    // Create profile if it doesn't exist
    const username = user.email?.split("@")[0] || "user"
    await supabase.from("profiles").insert({
      id: user.id,
      username,
      display_name: username,
    })
  }

  return <FeedContent userId={user.id} />
}
