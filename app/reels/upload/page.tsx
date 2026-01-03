import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { UploadReelContent } from "@/components/upload-reel-content"

export default async function UploadReelPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/sign-in")
  }

  return <UploadReelContent userId={user.id} />
}
