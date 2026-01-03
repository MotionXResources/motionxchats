import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MessagesContent } from "@/components/messages-content"

export default async function MessagesPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <MessagesContent userId={user.id} />
}
