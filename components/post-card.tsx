"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Heart, MessageCircle, Repeat2, User, Trash2, MoreVertical, BadgeCheck } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { createBrowserClient } from "@/lib/supabase/client"

interface Post {
  id: string
  user_id: string
  content: string | null
  image_url: string | null
  video_url: string | null
  created_at: string
}

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_admin?: boolean
}

interface PostCardProps {
  post: Post
  profile?: Profile
  currentUserId: string
}

interface Comment {
  id: string
  user_id: string
  content: string
  created_at: string
}

export function PostCard({ post, profile: initialProfile, currentUserId }: PostCardProps) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile || null)
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null)
  const [likesCount, setLikesCount] = useState(0)
  const [commentsCount, setCommentsCount] = useState(0)
  const [sharesCount, setSharesCount] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [isShared, setIsShared] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentProfiles, setCommentProfiles] = useState<Record<string, Profile>>({})
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = useMemo(() => createBrowserClient(), [])

  useEffect(() => {
    if (!initialProfile) {
      loadProfile()
    }
    loadCurrentUserProfile()
  }, [initialProfile, post.user_id, currentUserId])

  useEffect(() => {
    loadInteractions()
    subscribeToInteractions()
  }, [post.id])

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", post.user_id).single()
    if (data) setProfile(data)
  }

  const loadCurrentUserProfile = async () => {
    console.log("[v0] Loading current user profile for ID:", currentUserId)
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_admin")
      .eq("id", currentUserId)
      .single()

    if (error) {
      console.error("[v0] Error loading current user profile:", error)
    } else {
      console.log("[v0] Current user profile loaded:", data)
      setCurrentUserProfile(data)
    }
  }

  const loadInteractions = async () => {
    const { data: likes } = await supabase.from("likes").select("*").eq("post_id", post.id)
    setLikesCount(likes?.length || 0)
    setIsLiked(likes?.some((like) => like.user_id === currentUserId) || false)

    const { data: commentsData } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
    setCommentsCount(commentsData?.length || 0)
    if (commentsData) {
      setComments(commentsData)
      const userIds = [...new Set(commentsData.map((c) => c.user_id))]
      userIds.forEach(loadCommentProfile)
    }

    const { data: shares } = await supabase.from("shares").select("*").eq("post_id", post.id)
    setSharesCount(shares?.length || 0)
    setIsShared(shares?.some((share) => share.user_id === currentUserId) || false)
  }

  const loadCommentProfile = async (userId: string) => {
    if (commentProfiles[userId]) return
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
    if (data) {
      setCommentProfiles((prev) => ({ ...prev, [userId]: data }))
    }
  }

  const subscribeToInteractions = () => {
    const likesChannel = supabase
      .channel(`post-likes-${post.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes", filter: `post_id=eq.${post.id}` }, () => {
        loadInteractions()
      })
      .subscribe()

    const commentsChannel = supabase
      .channel(`post-comments-${post.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `post_id=eq.${post.id}` },
        (payload) => {
          const newComment = payload.new as Comment
          setComments((prev) => [...prev, newComment])
          setCommentsCount((prev) => prev + 1)
          loadCommentProfile(newComment.user_id)
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments", filter: `post_id=eq.${post.id}` },
        (payload) => {
          const deletedComment = payload.old as Comment
          setComments((prev) => prev.filter((c) => c.id !== deletedComment.id))
          setCommentsCount((prev) => prev - 1)
        },
      )
      .subscribe()

    const sharesChannel = supabase
      .channel(`post-shares-${post.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shares", filter: `post_id=eq.${post.id}` },
        () => {
          loadInteractions()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(likesChannel)
      supabase.removeChannel(commentsChannel)
      supabase.removeChannel(sharesChannel)
    }
  }

  const handleLike = async () => {
    const wasLiked = isLiked

    setIsLiked(!wasLiked)
    setLikesCount((prev) => (wasLiked ? prev - 1 : prev + 1))

    try {
      if (wasLiked) {
        const { error } = await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", currentUserId)
        if (error) throw error
      } else {
        const { error } = await supabase.from("likes").insert({ post_id: post.id, user_id: currentUserId })
        if (error) throw error
      }
    } catch (error) {
      console.error("Error toggling like:", error)
      setIsLiked(wasLiked)
      setLikesCount((prev) => (wasLiked ? prev + 1 : prev - 1))
    }
  }

  const handleShare = async () => {
    const wasShared = isShared

    setIsShared(!wasShared)
    setSharesCount((prev) => (wasShared ? prev - 1 : prev + 1))

    try {
      if (wasShared) {
        const { error } = await supabase.from("shares").delete().eq("post_id", post.id).eq("user_id", currentUserId)
        if (error) throw error
      } else {
        const { error } = await supabase.from("shares").insert({ post_id: post.id, user_id: currentUserId })
        if (error) throw error
      }
    } catch (error) {
      console.error("Error toggling share:", error)
      setIsShared(wasShared)
      setSharesCount((prev) => (wasShared ? prev + 1 : prev - 1))
    }
  }

  const handleComment = async () => {
    if (!newComment.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await supabase.from("comments").insert({
        post_id: post.id,
        user_id: currentUserId,
        content: newComment.trim(),
      })
      setNewComment("")
    } catch (error) {
      console.error("Error posting comment:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    setCommentsCount((prev) => prev - 1)

    try {
      const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", currentUserId)
      if (error) throw error
    } catch (error) {
      console.error("Error deleting comment:", error)
      loadInteractions()
    }
  }

  const handleDeletePost = async () => {
    if (!confirm("Are you sure you want to delete this post?")) return

    console.log("[v0] Attempting to delete post:", post.id)
    console.log("[v0] Current user is admin:", currentUserProfile?.is_admin)

    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id)

      if (error) {
        console.error("[v0] Error deleting post:", error)
        throw error
      }

      console.log("[v0] Post deleted successfully")
      window.location.reload()
    } catch (error) {
      console.error("Error deleting post:", error)
      alert("Failed to delete post")
    }
  }

  const canDeletePost = post.user_id === currentUserId || currentUserProfile?.is_admin === true

  console.log("[v0] Post delete check:", {
    postId: post.id,
    postUserId: post.user_id,
    currentUserId,
    isAdmin: currentUserProfile?.is_admin,
    canDelete: canDeletePost,
  })

  return (
    <Card className="p-4 transition-all duration-300 hover:bg-muted/50 hover:shadow-md hover:border-primary/20">
      <div className="flex gap-3">
        <Link href={`/profile/${post.user_id}`}>
          <Avatar className="h-10 w-10 cursor-pointer transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-primary active:scale-95">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-muted">
              <User className="h-5 w-5 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${post.user_id}`} className="font-semibold hover:underline">
              {profile?.display_name || "Loading..."}
            </Link>
            {profile?.is_admin && <BadgeCheck className="h-5 w-5 text-blue-500 fill-blue-500" />}
            <span className="text-sm text-muted-foreground">@{profile?.username || "..."}</span>
            <span className="text-sm text-muted-foreground">
              · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </span>
            {canDeletePost && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-8 w-8 p-0 transition-all hover:scale-110 active:scale-90"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDeletePost} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {post.content && <p className="mt-2 text-pretty whitespace-pre-wrap">{post.content}</p>}

          {post.image_url && (
            <div className="mt-3 rounded-lg overflow-hidden border">
              <img src={post.image_url || "/placeholder.svg"} alt="Post" className="w-full max-h-96 object-cover" />
            </div>
          )}

          {post.video_url && (
            <div className="mt-3 rounded-lg overflow-hidden border">
              <video src={post.video_url} controls className="w-full max-h-96" />
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={`transition-all duration-200 hover:scale-110 active:scale-90 ${isLiked ? "text-red-500" : ""}`}
            >
              <Heart className={`h-5 w-5 mr-1 transition-all ${isLiked ? "fill-current scale-110" : ""}`} />
              {likesCount > 0 && <span>{likesCount}</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className="transition-all duration-200 hover:scale-110 active:scale-90"
            >
              <MessageCircle className="h-5 w-5 mr-1" />
              {commentsCount > 0 && <span>{commentsCount}</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className={`transition-all duration-200 hover:scale-110 active:scale-90 ${isShared ? "text-green-600" : ""}`}
            >
              <Repeat2 className={`h-5 w-5 mr-1 transition-all ${isShared ? "scale-110" : ""}`} />
              {sharesCount > 0 && <span>{sharesCount}</span>}
            </Button>
          </div>

          {showComments && (
            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[60px] resize-none transition-all duration-200 focus:scale-[1.01]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleComment()
                    }
                  }}
                />
                <Button
                  onClick={handleComment}
                  disabled={!newComment.trim() || isSubmitting}
                  className="transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  {isSubmitting ? "..." : "Post"}
                </Button>
              </div>

              {comments.length > 0 && (
                <div className="space-y-3 pl-3 border-l-2">
                  {comments.map((comment, index) => (
                    <div
                      key={comment.id}
                      className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <Link href={`/profile/${comment.user_id}`}>
                        <Avatar className="h-7 w-7 cursor-pointer transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-primary">
                          <AvatarImage src={commentProfiles[comment.user_id]?.avatar_url || ""} />
                          <AvatarFallback className="bg-muted">
                            <User className="h-3 w-3 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link href={`/profile/${comment.user_id}`} className="text-sm font-semibold hover:underline">
                            {commentProfiles[comment.user_id]?.display_name || "Loading..."}
                          </Link>
                          {commentProfiles[comment.user_id]?.is_admin && (
                            <BadgeCheck className="h-4 w-4 text-blue-500 fill-blue-500" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{comment.content}</p>
                      </div>
                      {(comment.user_id === currentUserId || currentUserProfile?.is_admin === true) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive transition-all duration-200 hover:scale-110 active:scale-90"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
