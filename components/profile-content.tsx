"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, ArrowLeft, Settings, MessageCircle, Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { ProfileSettings } from "@/components/profile-settings"
import { PostCard } from "@/components/post-card"

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  likes_private?: boolean
  followers_private?: boolean
  allow_dm_from?: string
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
  const [likedPosts, setLikedPosts] = useState<Post[]>([])
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [canViewFollowers, setCanViewFollowers] = useState(false)
  const [canSendDM, setCanSendDM] = useState(false)
  const [dmRestrictionMessage, setDmRestrictionMessage] = useState("")
  const router = useRouter()

  const supabase = useMemo(() => createBrowserClient(), [])
  const isOwnProfile = profileId === currentUserId

  useEffect(() => {
    loadProfile()
    loadPosts()
    loadFollowStats()
    loadLikedPosts()
  }, [profileId])

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", profileId).single()
    if (data) {
      setProfile(data)
      checkDMPermissions(data)
    }
  }

  const checkDMPermissions = async (profileData: Profile) => {
    if (isOwnProfile) {
      setCanSendDM(false)
      return
    }

    const allowDmFrom = profileData.allow_dm_from || "everyone"

    if (allowDmFrom === "none") {
      setCanSendDM(false)
      setDmRestrictionMessage("This user doesn't accept messages")
      return
    }

    if (allowDmFrom === "everyone") {
      setCanSendDM(true)
      return
    }

    if (allowDmFrom === "followers") {
      // Check if current user follows this profile
      const { data } = await supabase
        .from("follows")
        .select("*")
        .eq("follower_id", currentUserId)
        .eq("following_id", profileId)
        .single()

      if (data) {
        setCanSendDM(true)
      } else {
        setCanSendDM(false)
        setDmRestrictionMessage("Follow this user to send messages")
      }
    }
  }

  const loadPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
    if (data) setPosts(data)
  }

  const loadLikedPosts = async () => {
    // Only load if viewing own profile or if likes are not private
    if (!isOwnProfile && profile?.likes_private) {
      setLikedPosts([])
      return
    }

    const { data: likes } = await supabase.from("likes").select("post_id").eq("user_id", profileId)

    if (likes && likes.length > 0) {
      const postIds = likes.map((like) => like.post_id)
      const { data: posts } = await supabase
        .from("posts")
        .select("*")
        .in("id", postIds)
        .order("created_at", { ascending: false })
      if (posts) setLikedPosts(posts)
    }
  }

  const loadFollowStats = async () => {
    const canView = isOwnProfile || !profile?.followers_private
    setCanViewFollowers(canView)

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
    if (profile) checkDMPermissions(profile)
  }

  const handleMessage = async () => {
    if (!canSendDM) {
      alert(dmRestrictionMessage || "You cannot message this user")
      return
    }

    console.log("[v0] Starting DM creation - Target user:", profileId)
    console.log("[v0] Current user:", currentUserId)

    try {
      // Check if conversation exists
      const { data: myParticipations, error: fetchError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", currentUserId)

      console.log("[v0] My participations:", myParticipations?.length || 0)

      if (fetchError) {
        console.error("[v0] Error fetching participations:", fetchError)
      }

      if (myParticipations && myParticipations.length > 0) {
        // Check each conversation to see if it includes the target user
        for (const participation of myParticipations) {
          const { data: participants } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", participation.conversation_id)

          if (participants && participants.some((p) => p.user_id === profileId)) {
            console.log("[v0] Found existing conversation:", participation.conversation_id)
            router.push(`/messages/${participation.conversation_id}`)
            return
          }
        }
      }

      console.log("[v0] No existing conversation, creating new one")

      // Create conversation
      const { data: newConv, error: convError } = await supabase.from("conversations").insert({}).select().single()

      if (convError) {
        console.error("[v0] Conversation creation error:", convError)
        alert(`Failed to create conversation: ${convError.message}`)
        return
      }

      console.log("[v0] Conversation created:", newConv?.id)

      if (!newConv) {
        alert("Failed to create conversation - no data returned")
        return
      }

      // Add current user first
      console.log("[v0] Adding current user as participant")
      const { error: participant1Error } = await supabase.from("conversation_participants").insert({
        conversation_id: newConv.id,
        user_id: currentUserId,
      })

      if (participant1Error) {
        console.error("[v0] Error adding current user:", participant1Error)
        // Clean up the conversation
        await supabase.from("conversations").delete().eq("id", newConv.id)
        alert(`Failed to add you to conversation: ${participant1Error.message}`)
        return
      }

      console.log("[v0] Current user added successfully")

      // Add target user
      console.log("[v0] Adding target user as participant")
      const { error: participant2Error } = await supabase.from("conversation_participants").insert({
        conversation_id: newConv.id,
        user_id: profileId,
      })

      if (participant2Error) {
        console.error("[v0] Error adding target user:", participant2Error)
        // Clean up
        await supabase.from("conversations").delete().eq("id", newConv.id)
        alert(`Failed to add participant: ${participant2Error.message}`)
        return
      }

      console.log("[v0] Target user added successfully, navigating to conversation")
      router.push(`/messages/${newConv.id}`)
    } catch (error) {
      console.error("[v0] Unexpected error in handleMessage:", error)
      alert("An unexpected error occurred. Please try again.")
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
                    disabled={!canSendDM}
                    title={canSendDM ? "Send message" : dmRestrictionMessage}
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
            {canViewFollowers ? (
              <>
                <div>
                  <span className="font-semibold">{followingCount}</span>{" "}
                  <span className="text-muted-foreground">Following</span>
                </div>
                <div>
                  <span className="font-semibold">{followersCount}</span>{" "}
                  <span className="text-muted-foreground">Followers</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>Followers and following are private</span>
              </div>
            )}
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
              {!isOwnProfile && profile.likes_private && <Lock className="h-3 w-3 ml-1" />}
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
            {!isOwnProfile && profile.likes_private ? (
              <Card className="p-8 text-center">
                <Lock className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Liked posts are private</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This user has chosen to keep their liked posts private
                </p>
              </Card>
            ) : likedPosts.length > 0 ? (
              likedPosts.map((post, index) => (
                <div
                  key={post.id}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <PostCard post={post} currentUserId={currentUserId} />
                </div>
              ))
            ) : (
              <Card className="p-8 text-center text-muted-foreground">
                <p>No liked posts yet</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {showSettings && profile && (
        <ProfileSettings
          profile={profile}
          onClose={() => {
            setShowSettings(false)
            loadProfile()
            loadFollowStats()
            loadLikedPosts()
          }}
        />
      )}
    </div>
  )
}
