import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SearchContent } from "@/components/search-content"

export default async function SearchPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  return <SearchContent userId={user.id} />
}
