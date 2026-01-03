import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CommunitiesContent } from "@/components/communities-content"

export default async function CommunitiesPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <CommunitiesContent userId={user.id} />
}
