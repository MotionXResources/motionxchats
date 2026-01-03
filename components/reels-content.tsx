"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Heart,
  MessageCircle,
  Share2,
  User,
  Home,
  MessageSquare,
  Search,
  Film,
  Volume2,
  VolumeX,
  Play,
  Plus,
} from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"

interface Post {
  id: string
  user_id: string
  content: string | null
  video_url: string | null
  created_at: string
}

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_admin: boolean
}

export function ReelsContent({ userId }: { userId: string }) {
  const [reels, setReels] = useState<Post[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [likes, setLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({})
  const [comments, setComments] = useState<Record<string, number>>({})
  const [isMuted, setIsMuted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({})
  const containerRef = useRef<HTMLDivElement>(null)

  const supabase = useMemo(() => createBrowserClient(), [])

  useEffect(() => {
    loadCurrentProfile()
    loadReels()

    const channel = supabase
      .channel("reels-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        loadReels()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, (payload: any) => {
        const like = payload.new
        if (like?.post_id) {
          loadLikes(like.post_id)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return
      const scrollTop = containerRef.current.scrollTop
      const windowHeight = window.innerHeight
      const newIndex = Math.round(scrollTop / windowHeight)
      if (newIndex !== currentIndex && newIndex < reels.length) {
        setCurrentIndex(newIndex)
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener("scroll", handleScroll)
      return () => container.removeEventListener("scroll", handleScroll)
    }
  }, [currentIndex, reels.length])

  useEffect(() => {
    Object.values(videoRefs.current).forEach((video, idx) => {
      if (idx === currentIndex) {
        if (isPlaying) {
          video.play()
        }
      } else {
        video.pause()
      }
    })
  }, [currentIndex, isPlaying])

  const loadCurrentProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
    if (data) setCurrentProfile(data)
  }

  const loadReels = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .not("video_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(50)

    if (data) {
      setReels(data)
      const userIds = [...new Set(data.map((p) => p.user_id))]
      userIds.forEach(loadProfile)
      data.forEach((post) => {
        loadLikes(post.id)
        loadCommentCount(post.id)
      })
    }
  }

  const loadProfile = async (userId: string) => {
    if (profiles[userId]) return
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
    if (data) {
      setProfiles((prev) => ({ ...prev, [userId]: data }))
    }
  }

  const loadLikes = async (postId: string) => {
    const { count } = await supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", postId)

    const { data: userLike } = await supabase
      .from("likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle()

    setLikes((prev) => ({
      ...prev,
      [postId]: { count: count || 0, isLiked: !!userLike },
    }))
  }

  const loadCommentCount = async (postId: string) => {
    const { count } = await supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", postId)

    setComments((prev) => ({
      ...prev,
      [postId]: count || 0,
    }))
  }

  const handleLike = async (postId: string, postUserId: string) => {
    const currentLike = likes[postId]
    if (currentLike?.isLiked) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId)
    } else {
      await supabase.from("likes").insert({ post_id: postId, user_id: userId })

      if (postUserId !== userId) {
        await supabase.from("notifications").insert({
          user_id: postUserId,
          type: "like",
          content: "liked your post",
          related_post_id: postId,
          from_user_id: userId,
        })
      }
    }
    loadLikes(postId)
  }

  const togglePlayPause = () => {
    const currentVideo = videoRefs.current[reels[currentIndex]?.id]
    if (currentVideo) {
      if (isPlaying) {
        currentVideo.pause()
        setIsPlaying(false)
      } else {
        currentVideo.play()
        setIsPlaying(true)
      }
    }
  }

  return (
    <div className="h-screen bg-black overflow-hidden flex flex-col">
      {/* Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/feed" className="text-white text-xl font-bold transition-all hover:scale-105">
              MotionX
            </Link>
            <div className="flex gap-4">
              <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/20">
                <Link href="/feed">
                  <Home className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/20">
                <Link href="/search">
                  <Search className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/20">
                <Link href="/reels">
                  <Film className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/20">
                <Link href="/reels/upload">
                  <Plus className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/20">
                <Link href="/messages">
                  <MessageSquare className="h-5 w-5" />
                </Link>
              </Button>
              {currentProfile && (
                <Link href={`/profile/${currentProfile.id}`}>
                  <Avatar className="h-8 w-8 cursor-pointer transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-white">
                    <AvatarImage src={currentProfile.avatar_url || ""} />
                    <AvatarFallback className="bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Video Container */}
      <div ref={containerRef} className="flex-1 overflow-y-scroll snap-y snap-mandatory">
        {reels.map((reel, index) => {
          const profile = profiles[reel.user_id]
          const likeData = likes[reel.id] || { count: 0, isLiked: false }
          const commentCount = comments[reel.id] || 0

          return (
            <div
              key={reel.id}
              className="relative h-screen w-full snap-start snap-always flex items-center justify-center"
            >
              {/* Video */}
              <video
                ref={(el) => {
                  if (el) videoRefs.current[reel.id] = el
                }}
                src={reel.video_url || ""}
                className="absolute inset-0 w-full h-full object-contain bg-black"
                loop
                playsInline
                muted={isMuted}
                onClick={togglePlayPause}
              />

              {/* Play/Pause Overlay */}
              {!isPlaying && index === currentIndex && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/50 rounded-full p-8 animate-in fade-in zoom-in duration-200">
                    <Play className="h-16 w-16 text-white" />
                  </div>
                </div>
              )}

              {/* Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-end gap-4">
                  {/* User Info */}
                  <div className="flex-1">
                    {profile && (
                      <Link href={`/profile/${profile.id}`} className="flex items-center gap-2 mb-2">
                        <Avatar className="h-10 w-10 border-2 border-white transition-transform hover:scale-110">
                          <AvatarImage src={profile.avatar_url || ""} />
                          <AvatarFallback className="bg-muted">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-white font-semibold">{profile.display_name}</span>
                            {profile.is_admin && (
                              <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-600 h-4 px-1">
                                ✓
                              </Badge>
                            )}
                          </div>
                          <span className="text-white/70 text-sm">@{profile.username}</span>
                        </div>
                      </Link>
                    )}
                    {reel.content && (
                      <p className="text-white text-sm mb-2 line-clamp-3 text-balance">{reel.content}</p>
                    )}
                    <p className="text-white/60 text-xs">
                      {formatDistanceToNow(new Date(reel.created_at), { addSuffix: true })}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-4">
                    <button
                      onClick={() => handleLike(reel.id, reel.user_id)}
                      className="flex flex-col items-center gap-1 transition-all active:scale-90 hover:scale-110"
                    >
                      <div className={`rounded-full p-3 ${likeData.isLiked ? "bg-red-500" : "bg-white/20"}`}>
                        <Heart className={`h-6 w-6 ${likeData.isLiked ? "fill-white text-white" : "text-white"}`} />
                      </div>
                      <span className="text-white text-xs font-semibold">{likeData.count}</span>
                    </button>

                    <Link
                      href={`/feed`}
                      className="flex flex-col items-center gap-1 transition-all active:scale-90 hover:scale-110"
                    >
                      <div className="rounded-full bg-white/20 p-3">
                        <MessageCircle className="h-6 w-6 text-white" />
                      </div>
                      <span className="text-white text-xs font-semibold">{commentCount}</span>
                    </Link>

                    <button className="flex flex-col items-center gap-1 transition-all active:scale-90 hover:scale-110">
                      <div className="rounded-full bg-white/20 p-3">
                        <Share2 className="h-6 w-6 text-white" />
                      </div>
                    </button>

                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="flex flex-col items-center gap-1 transition-all active:scale-90 hover:scale-110"
                    >
                      <div className="rounded-full bg-white/20 p-3">
                        {isMuted ? (
                          <VolumeX className="h-6 w-6 text-white" />
                        ) : (
                          <Volume2 className="h-6 w-6 text-white" />
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {reels.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <Film className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-xl">No videos yet</p>
            <p className="text-sm text-white/60 mt-2">Be the first to upload a video!</p>
          </div>
        </div>
      )}
    </div>
  )
}
