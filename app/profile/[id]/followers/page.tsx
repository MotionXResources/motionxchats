import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { FollowersContent } from "@/components/followers-content"

export default async function FollowersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <FollowersContent profileId={id} currentUserId={user.id} />
}
