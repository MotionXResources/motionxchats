"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Paperclip, X, User, Home, MessageSquare, Users, Bell } from "lucide-react"
import { uploadFile } from "@/app/actions/upload"
import Link from "next/link"
import { PostCard } from "@/components/post-card"
import { Badge } from "@/components/ui/badge"

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
}

export function FeedContent({ userId }: { userId: string }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [newPostContent, setNewPostContent] = useState("")
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null)
  const [attachmentType, setAttachmentType] = useState<"image" | "video" | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  const supabase = useMemo(() => createBrowserClient(), [])

  useEffect(() => {
    loadCurrentProfile()
    loadPosts()
    loadNotificationCounts()

    const channel = supabase
      .channel("posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) => {
        const newPost = payload.new as Post
        setPosts((prev) => [newPost, ...prev])
        loadProfile(newPost.user_id)
      })
      .subscribe()

    const notifChannel = supabase
      .channel(`notifications-badge-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotificationCounts()
        },
      )
      .subscribe()

    const messagesChannel = supabase
      .channel(`messages-badge-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        async (payload) => {
          const newMsg = payload.new as any
          const { data: isParticipant } = await supabase
            .from("conversation_participants")
            .select("*")
            .eq("conversation_id", newMsg.conversation_id)
            .eq("user_id", userId)
            .single()

          if (isParticipant && newMsg.user_id !== userId) {
            loadNotificationCounts()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(notifChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [supabase])

  const loadCurrentProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
    if (data) setCurrentProfile(data)
  }

  const loadPosts = async () => {
    const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(50)

    if (data) {
      setPosts(data)
      const userIds = [...new Set(data.map((p) => p.user_id))]
      userIds.forEach(loadProfile)
    }
  }

  const loadProfile = async (userId: string) => {
    if (profiles[userId]) return
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
    if (data) {
      setProfiles((prev) => ({ ...prev, [userId]: data }))
    }
  }

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB")
      return
    }

    setAttachmentFile(file)
    const isImage = file.type.startsWith("image/")
    const isVideo = file.type.startsWith("video/")
    setAttachmentType(isImage ? "image" : isVideo ? "video" : null)

    const reader = new FileReader()
    reader.onload = () => setAttachmentPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const clearAttachment = () => {
    setAttachmentFile(null)
    setAttachmentPreview(null)
    setAttachmentType(null)
  }

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !attachmentFile) return

    setIsPosting(true)
    try {
      let imageUrl: string | null = null
      let videoUrl: string | null = null

      if (attachmentFile) {
        const formData = new FormData()
        formData.append("file", attachmentFile)
        formData.append("filename", `posts/${Date.now()}-${attachmentFile.name}`)

        const result = await uploadFile(formData)
        if (result.error) {
          alert(result.error)
          setIsPosting(false)
          return
        }

        if (attachmentType === "image") {
          imageUrl = result.url
        } else if (attachmentType === "video") {
          videoUrl = result.url
        }
      }

      const { error } = await supabase.from("posts").insert({
        user_id: userId,
        content: newPostContent.trim() || null,
        image_url: imageUrl,
        video_url: videoUrl,
      })

      if (error) throw error

      setNewPostContent("")
      clearAttachment()
    } catch (error) {
      console.error("Error creating post:", error)
      alert("Failed to create post")
    } finally {
      setIsPosting(false)
    }
  }

  const loadNotificationCounts = async () => {
    const { data: notifData } = await supabase
      .from("notifications")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .eq("is_read", false)

    setUnreadNotifications(notifData?.length || 0)

    const { data: conversations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId)

    if (conversations) {
      let totalUnread = 0
      for (const conv of conversations) {
        const { data: lastMsg, error } = await supabase
          .from("direct_messages")
          .select("user_id")
          .eq("conversation_id", conv.conversation_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!error && lastMsg && lastMsg.user_id !== userId) {
          totalUnread++
        }
      }
      setUnreadMessages(totalUnread)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/feed" className="text-xl font-bold transition-all hover:scale-105">
                MotionX
              </Link>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" asChild className="transition-all hover:scale-105 active:scale-95">
                  <Link href="/feed">
                    <Home className="h-5 w-5 mr-2" />
                    Feed
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild className="transition-all hover:scale-105 active:scale-95">
                  <Link href="/communities">
                    <Users className="h-5 w-5 mr-2" />
                    Communities
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="transition-all hover:scale-105 active:scale-95 relative"
                >
                  <Link href="/messages">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Messages
                    {unreadMessages > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-1 text-xs"
                      >
                        {unreadMessages}
                      </Badge>
                    )}
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="transition-all hover:scale-105 active:scale-95 relative"
                >
                  <Link href="/notifications">
                    <Bell className="h-5 w-5 mr-2" />
                    Inbox
                    {unreadNotifications > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-1 text-xs"
                      >
                        {unreadNotifications}
                      </Badge>
                    )}
                  </Link>
                </Button>
              </div>
            </div>

            {currentProfile && (
              <Link href={`/profile/${currentProfile.id}`}>
                <Avatar className="h-8 w-8 cursor-pointer transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-primary active:scale-95">
                  <AvatarImage src={currentProfile.avatar_url || ""} />
                  <AvatarFallback className="bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Card className="p-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex gap-3">
            {currentProfile && (
              <Avatar className="h-10 w-10">
                <AvatarImage src={currentProfile.avatar_url || ""} />
                <AvatarFallback className="bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1">
              <Textarea
                placeholder="What's happening?"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="min-h-[80px] resize-none border-0 p-0 focus-visible:ring-0 transition-all duration-200 focus:scale-[1.01]"
              />

              {attachmentPreview && (
                <div className="relative mt-3 rounded-lg overflow-hidden border">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-2 right-2 z-10"
                    onClick={clearAttachment}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {attachmentType === "image" ? (
                    <img
                      src={attachmentPreview || "/placeholder.svg"}
                      alt="Preview"
                      className="w-full max-h-96 object-cover"
                    />
                  ) : (
                    <video src={attachmentPreview} controls className="w-full max-h-96" />
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="relative" disabled={isPosting}>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleAttachmentChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isPosting}
                    />
                    <Paperclip className="h-5 w-5" />
                  </Button>
                </div>
                <Button
                  onClick={handleCreatePost}
                  disabled={(!newPostContent.trim() && !attachmentFile) || isPosting}
                  className="transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  {isPosting ? "Posting..." : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {posts.map((post, index) => (
            <div
              key={post.id}
              className="animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <PostCard post={post} profile={profiles[post.user_id]} currentUserId={userId} />
            </div>
          ))}
        </div>

        {posts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No posts yet. Be the first to post something!</p>
          </div>
        )}
      </div>
    </div>
  )
}
