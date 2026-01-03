import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { NotificationsContent } from "@/components/notifications-content"

export default async function NotificationsPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <NotificationsContent userId={user.id} />
}
