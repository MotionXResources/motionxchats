"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { User, Search, ArrowLeft, MessageCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
}

export function SearchContent({ userId }: { userId: string }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [followStatus, setFollowStatus] = useState<Record<string, boolean>>({})
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    const timeoutId = setTimeout(() => {
      performSearch()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const performSearch = async () => {
    setIsSearching(true)
    const query = searchQuery.trim().toLowerCase()

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq("id", userId)
      .limit(20)

    if (data) {
      setSearchResults(data)
      loadFollowStatus(data.map((p) => p.id))
    }

    setIsSearching(false)
  }

  const loadFollowStatus = async (profileIds: string[]) => {
    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .in("following_id", profileIds)

    if (data) {
      const status: Record<string, boolean> = {}
      data.forEach((follow) => {
        status[follow.following_id] = true
      })
      setFollowStatus(status)
    }
  }

  const handleFollow = async (profileId: string) => {
    const isFollowing = followStatus[profileId]

    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", profileId)
      setFollowStatus((prev) => ({ ...prev, [profileId]: false }))
    } else {
      await supabase.from("follows").insert({ follower_id: userId, following_id: profileId })
      setFollowStatus((prev) => ({ ...prev, [profileId]: true }))
    }
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
              className="transition-all duration-200 hover:scale-110 active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-bold text-lg">Search Users</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl py-6">
        <div className="relative mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by username or display name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base"
            autoFocus
          />
        </div>

        {isSearching && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Searching...</p>
          </div>
        )}

        {!isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <p>No users found for "{searchQuery}"</p>
          </Card>
        )}

        <div className="space-y-3">
          {searchResults.map((profile, index) => (
            <Card
              key={profile.id}
              className="p-4 animate-in fade-in slide-in-from-bottom-4 duration-500 hover:shadow-lg transition-all"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <Link href={`/profile/${profile.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-12 w-12 transition-all hover:scale-110">
                    <AvatarImage src={profile.avatar_url || ""} />
                    <AvatarFallback className="bg-muted">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{profile.display_name}</p>
                    <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>
                    {profile.bio && <p className="text-sm text-muted-foreground truncate mt-1">{profile.bio}</p>}
                  </div>
                </Link>

                <div className="flex gap-2 ml-4">
                  <Button
                    variant={followStatus[profile.id] ? "outline" : "default"}
                    size="sm"
                    onClick={() => handleFollow(profile.id)}
                    className="transition-all hover:scale-105 active:scale-95"
                  >
                    {followStatus[profile.id] ? "Following" : "Follow"}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => router.push(`/profile/${profile.id}`)}
                    className="transition-all hover:scale-110 active:scale-95"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {searchQuery.trim().length < 2 && (
          <Card className="p-8 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Start typing to search for users</p>
            <p className="text-sm mt-1">Search by username or display name</p>
          </Card>
        )}
      </div>
    </div>
  )
}
