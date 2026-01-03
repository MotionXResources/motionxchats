import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { ReelsContent } from "@/components/reels-content"

export default async function ReelsPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  return <ReelsContent userId={user.id} />
}
