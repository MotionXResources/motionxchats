"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { ArrowLeft, User, Lock } from "lucide-react"
import { useRouter } from "next/navigation"

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  followers_private: boolean
}

export function FollowersContent({ profileId, currentUserId }: { profileId: string; currentUserId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [followers, setFollowers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [canView, setCanView] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])

  useEffect(() => {
    loadProfile()
  }, [profileId])

  const loadProfile = async () => {
    const { data: profileData } = await supabase.from("profiles").select("*").eq("id", profileId).single()

    if (profileData) {
      setProfile(profileData)

      if (!profileData.followers_private || profileId === currentUserId) {
        setCanView(true)
        await loadFollowers()
      } else {
        setCanView(false)
      }
    }
    setLoading(false)
  }

  const loadFollowers = async () => {
    const { data: followsData } = await supabase.from("follows").select("follower_id").eq("following_id", profileId)

    if (followsData) {
      const followerIds = followsData.map((f) => f.follower_id)
      if (followerIds.length > 0) {
        const { data: profilesData } = await supabase.from("profiles").select("*").in("id", followerIds)
        if (profilesData) {
          setFollowers(profilesData)
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="transition-transform active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{profile?.display_name}</h1>
              <p className="text-sm text-muted-foreground">@{profile?.username}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl py-4">
        {!canView ? (
          <Card className="p-12 text-center">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">This account's followers are private</h3>
            <p className="text-sm text-muted-foreground">Only they can see who follows them</p>
          </Card>
        ) : followers.length > 0 ? (
          <div className="space-y-2">
            {followers.map((follower) => (
              <Card
                key={follower.id}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-all active:scale-[0.99]"
                onClick={() => router.push(`/profile/${follower.id}`)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={follower.avatar_url || ""} />
                    <AvatarFallback className="bg-muted">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{follower.display_name}</h3>
                    <p className="text-sm text-muted-foreground">@{follower.username}</p>
                    {follower.bio && <p className="text-sm text-muted-foreground truncate mt-1">{follower.bio}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No followers yet</h3>
            <p className="text-sm text-muted-foreground">When someone follows this account, they'll appear here</p>
          </Card>
        )}
      </div>
    </div>
  )
}
