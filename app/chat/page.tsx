import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ChatInterface } from "@/components/chat-interface"

export default async function Page() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle()

  if (!profile) {
    const { data: newProfile } = await supabase
      .from("profiles")
      .insert({
        id: data.user.id,
        username: data.user.email?.split("@")[0] || "user",
        display_name: data.user.user_metadata?.display_name || data.user.email?.split("@")[0] || "User",
      })
      .select()
      .single()

    // Fetch chat rooms
    const { data: rooms } = await supabase.from("chat_rooms").select("*").order("created_at", { ascending: true })

    return <ChatInterface user={data.user} profile={newProfile || null} rooms={rooms || []} />
  }

  // Fetch chat rooms
  const { data: rooms } = await supabase.from("chat_rooms").select("*").order("created_at", { ascending: true })

  return <ChatInterface user={data.user} profile={profile} rooms={rooms || []} />
}
