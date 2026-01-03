import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ProfileContent } from "@/components/profile-content"

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <ProfileContent profileId={id} currentUserId={user.id} />
}
