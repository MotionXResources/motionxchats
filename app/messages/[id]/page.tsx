import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ConversationContent } from "@/components/conversation-content"

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <ConversationContent conversationId={id} userId={user.id} />
}
