import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ChatInterface } from "@/components/chat-interface"

export default async function CommunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()

  if (!profile) {
    const username = user.email?.split("@")[0] || "user"
    const { data: newProfile } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        username,
        display_name: username,
      })
      .select()
      .single()

    return <ChatInterface user={user} profile={newProfile || null} initialRoomId={id} />
  }

  return <ChatInterface user={user} profile={profile} initialRoomId={id} />
}
