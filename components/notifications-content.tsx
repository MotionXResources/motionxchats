"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { ArrowLeft, User, Heart, MessageCircle, UserPlus, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"

interface Notification {
  id: string
  type: string
  from_user_id: string
  post_id?: string
  comment_id?: string
  conversation_id?: string
  is_read: boolean
  created_at: string
}

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

export function NotificationsContent({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])

  useEffect(() => {
    loadNotifications()

    // Subscribe to new notifications
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications((prev) => [newNotif, ...prev])
          loadProfile(newNotif.from_user_id)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const loadNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (data) {
      setNotifications(data)
      const userIds = [...new Set(data.map((n) => n.from_user_id))]
      userIds.forEach(loadProfile)
    }
  }

  const loadProfile = async (profileId: string) => {
    if (profiles[profileId]) return
    const { data } = await supabase.from("profiles").select("*").eq("id", profileId).single()
    if (data) {
      setProfiles((prev) => ({ ...prev, [profileId]: data }))
    }
  }

  const markAsRead = async (notificationId: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId)
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)))
  }

  const markAllAsRead = async () => {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "follow":
        return <UserPlus className="h-5 w-5 text-blue-500" />
      case "like":
        return <Heart className="h-5 w-5 text-red-500" />
      case "comment":
        return <MessageCircle className="h-5 w-5 text-green-500" />
      case "message":
        return <MessageCircle className="h-5 w-5 text-purple-500" />
      default:
        return null
    }
  }

  const getNotificationText = (notif: Notification) => {
    const profile = profiles[notif.from_user_id]
    const displayName = profile?.display_name || "Someone"

    switch (notif.type) {
      case "follow":
        return `${displayName} started following you`
      case "like":
        return `${displayName} liked your post`
      case "comment":
        return `${displayName} commented on your post`
      case "message":
        return `${displayName} sent you a message`
      default:
        return "New notification"
    }
  }

  const getNotificationLink = (notif: Notification) => {
    if (notif.type === "follow") {
      return `/profile/${notif.from_user_id}`
    } else if (notif.type === "message" && notif.conversation_id) {
      return `/messages/${notif.conversation_id}`
    } else if (notif.post_id) {
      return `/feed` // Could be improved to scroll to specific post
    }
    return "/feed"
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

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
              className="transition-transform active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                className="ml-auto transition-transform active:scale-95 bg-transparent"
              >
                <Check className="h-4 w-4 mr-2" />
                Mark all as read
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl py-4">
        {notifications.length > 0 ? (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const profile = profiles[notif.from_user_id]
              return (
                <Card
                  key={notif.id}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-all active:scale-[0.99] ${
                    !notif.is_read ? "bg-muted/30 border-primary/20" : ""
                  }`}
                  onClick={() => {
                    markAsRead(notif.id)
                    router.push(getNotificationLink(notif))
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-muted">
                          <User className="h-6 w-6 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1">
                        {getNotificationIcon(notif.type)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{getNotificationText(notif)}</p>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {!notif.is_read && <div className="h-2 w-2 bg-primary rounded-full" />}
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No notifications yet</h3>
            <p className="text-sm text-muted-foreground">
              When someone follows you, likes your posts, or comments, you'll see it here
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
