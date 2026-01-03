import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { FollowingContent } from "@/components/following-content"

export default async function FollowingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <FollowingContent profileId={id} currentUserId={user.id} />
}
