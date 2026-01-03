"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, ArrowLeft, Settings, MessageCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { ProfileSettings } from "@/components/profile-settings"
import { PostCard } from "@/components/post-card"

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
}

interface Post {
  id: string
  user_id: string
  content: string | null
  image_url: string | null
  video_url: string | null
  created_at: string
}

export function ProfileContent({ profileId, currentUserId }: { profileId: string; currentUserId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const router = useRouter()

  const supabase = useMemo(() => createBrowserClient(), [])
  const isOwnProfile = profileId === currentUserId

  useEffect(() => {
    loadProfile()
    loadPosts()
    loadFollowStats()
  }, [profileId])

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", profileId).single()
    if (data) setProfile(data)
  }

  const loadPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
    if (data) setPosts(data)
  }

  const loadFollowStats = async () => {
    // Followers count
    const { data: followers } = await supabase.from("follows").select("*").eq("following_id", profileId)
    setFollowersCount(followers?.length || 0)
    setIsFollowing(followers?.some((f) => f.follower_id === currentUserId) || false)

    // Following count
    const { data: following } = await supabase.from("follows").select("*").eq("follower_id", profileId)
    setFollowingCount(following?.length || 0)
  }

  const handleFollow = async () => {
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", profileId)
      setIsFollowing(false)
      setFollowersCount((prev) => prev - 1)
    } else {
      await supabase.from("follows").insert({ follower_id: currentUserId, following_id: profileId })
      setIsFollowing(true)
      setFollowersCount((prev) => prev + 1)
    }
  }

  const handleMessage = async () => {
    // Check if conversation exists
    const { data: existingConversations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", currentUserId)

    if (existingConversations) {
      for (const conv of existingConversations) {
        const { data: otherParticipant } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", conv.conversation_id)
          .neq("user_id", currentUserId)
          .single()

        if (otherParticipant?.user_id === profileId) {
          router.push(`/messages/${conv.conversation_id}`)
          return
        }
      }
    }

    // Create new conversation
    const { data: newConv } = await supabase.from("conversations").insert({}).select().single()

    if (newConv) {
      await supabase.from("conversation_participants").insert([
        { conversation_id: newConv.id, user_id: currentUserId },
        { conversation_id: newConv.id, user_id: profileId },
      ])
      router.push(`/messages/${newConv.id}`)
    }
  }

  if (!profile) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            <div>
              <h1 className="font-bold">{profile.display_name}</h1>
              <p className="text-sm text-muted-foreground">{posts.length} posts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl">
        {/* Profile Header */}
        <div className="py-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-start justify-between">
            <Avatar className="h-24 w-24 transition-all duration-200 hover:scale-105 hover:ring-4 hover:ring-primary/20">
              <AvatarImage src={profile.avatar_url || ""} />
              <AvatarFallback className="bg-muted text-2xl">
                <User className="h-12 w-12 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>

            <div className="flex gap-2">
              {isOwnProfile ? (
                <Button
                  onClick={() => setShowSettings(true)}
                  variant="outline"
                  className="transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleFollow}
                    variant={isFollowing ? "outline" : "default"}
                    className="transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </Button>
                  <Button
                    onClick={handleMessage}
                    variant="outline"
                    size="icon"
                    className="transition-all duration-200 hover:scale-110 active:scale-95 bg-transparent"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold">{profile.display_name}</h2>
            <p className="text-muted-foreground">@{profile.username}</p>
          </div>

          {profile.bio && <p className="text-pretty">{profile.bio}</p>}

          <div className="flex gap-4 text-sm">
            <div>
              <span className="font-semibold">{followingCount}</span>{" "}
              <span className="text-muted-foreground">Following</span>
            </div>
            <div>
              <span className="font-semibold">{followersCount}</span>{" "}
              <span className="text-muted-foreground">Followers</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="posts" className="flex-1 transition-all duration-200 data-[state=active]:scale-105">
              Posts
            </TabsTrigger>
            <TabsTrigger value="likes" className="flex-1 transition-all duration-200 data-[state=active]:scale-105">
              Likes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-4 mt-4">
            {posts.length > 0 ? (
              posts.map((post, index) => (
                <div
                  key={post.id}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <PostCard post={post} profile={profile} currentUserId={currentUserId} />
                </div>
              ))
            ) : (
              <Card className="p-8 text-center text-muted-foreground">
                <p>No posts yet</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="likes" className="space-y-4 mt-4">
            <Card className="p-8 text-center text-muted-foreground">
              <p>Liked posts will appear here</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {showSettings && profile && <ProfileSettings profile={profile} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
