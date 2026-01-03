"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { ArrowLeft, User, MessageSquare, BadgeCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"

interface Conversation {
  id: string
  created_at: string
}

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_admin?: boolean
}

interface ConversationWithDetails {
  conversation: Conversation
  otherUser: Profile
  lastMessage?: {
    content: string | null
    created_at: string
  }
}

export function MessagesContent({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])

  useEffect(() => {
    loadConversations()

    const participantsChannel = supabase
      .channel("user-conversations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadConversations()
        },
      )
      .subscribe()

    const messagesChannel = supabase
      .channel("all-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        () => {
          loadConversations()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(participantsChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [userId])

  const loadConversations = async () => {
    setLoading(true)

    try {
      // Get all conversation IDs where user is a participant
      const { data: userConvs, error: convsError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId)

      if (convsError || !userConvs || userConvs.length === 0) {
        setConversations([])
        setLoading(false)
        return
      }

      const conversationIds = userConvs.map((c) => c.conversation_id)

      // Batch fetch all conversations
      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .in("id", conversationIds)

      if (convError) {
        console.error("Error fetching conversations:", convError)
        setLoading(false)
        return
      }

      // Batch fetch all participants for these conversations
      const { data: allParticipants, error: partError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", conversationIds)

      if (partError) {
        console.error("Error fetching participants:", partError)
        setLoading(false)
        return
      }

      // Get other user IDs (not current user)
      const otherUserIds = allParticipants
        .filter((p) => p.user_id !== userId)
        .map((p) => p.user_id)
        .filter((id, index, self) => self.indexOf(id) === index) // unique

      // Batch fetch all profiles
      const { data: profiles, error: profileError } = await supabase.from("profiles").select("*").in("id", otherUserIds)

      if (profileError) {
        console.error("Error fetching profiles:", profileError)
        setLoading(false)
        return
      }

      // Batch fetch all messages for these conversations
      const { data: allMessages, error: messagesError } = await supabase
        .from("direct_messages")
        .select("conversation_id, content, created_at, user_id")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })

      if (messagesError) {
        console.error("Error fetching messages:", messagesError)
      }

      // Batch fetch follow relationships
      const { data: followRelationships, error: followError } = await supabase
        .from("follows")
        .select("follower_id, following_id")
        .eq("follower_id", userId)
        .in("following_id", otherUserIds)

      if (followError) {
        console.error("Error checking follow relationships:", followError)
      }

      // Build conversation map
      const conversationMap = new Map<string, ConversationWithDetails>()
      const followingSet = new Set(followRelationships?.map((f) => f.following_id) || [])

      for (const conv of conversations || []) {
        // Find other participant
        const otherParticipant = allParticipants.find((p) => p.conversation_id === conv.id && p.user_id !== userId)

        if (!otherParticipant) continue

        // Find profile
        const profile = profiles?.find((p) => p.id === otherParticipant.user_id)
        if (!profile) continue

        // Find messages for this conversation
        const convMessages = allMessages?.filter((m) => m.conversation_id === conv.id) || []
        const hasMessages = convMessages.length > 0
        const isFollowing = followingSet.has(otherParticipant.user_id)

        // Skip if no messages and not following
        if (!hasMessages && !isFollowing) continue

        const lastMessage = convMessages[0]

        const conversationDetail: ConversationWithDetails = {
          conversation: conv,
          otherUser: profile,
          lastMessage: lastMessage || undefined,
        }

        // Keep only most recent conversation per user
        const existingConv = conversationMap.get(otherParticipant.user_id)
        const currentTime = lastMessage?.created_at || conv.created_at
        const existingTime = existingConv?.lastMessage?.created_at || existingConv?.conversation.created_at

        if (!existingConv || new Date(currentTime).getTime() > new Date(existingTime).getTime()) {
          conversationMap.set(otherParticipant.user_id, conversationDetail)
        }
      }

      // Sort by most recent activity
      const conversationDetails = Array.from(conversationMap.values()).sort((a, b) => {
        const timeA = a.lastMessage?.created_at || a.conversation.created_at
        const timeB = b.lastMessage?.created_at || b.conversation.created_at
        return new Date(timeB).getTime() - new Date(timeA).getTime()
      })

      setConversations(conversationDetails)
    } catch (error) {
      console.error("Unexpected error loading conversations:", error)
    } finally {
      setLoading(false)
    }
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
              className="transition-transform active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Messages</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl py-4">
        {loading ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Loading conversations...</p>
          </Card>
        ) : conversations.length > 0 ? (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <Card
                key={conv.conversation.id}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-all active:scale-[0.99]"
                onClick={() => router.push(`/messages/${conv.conversation.id}`)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={conv.otherUser.avatar_url || ""} />
                    <AvatarFallback className="bg-muted">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{conv.otherUser.display_name}</h3>
                        {conv.otherUser.is_admin && <BadgeCheck className="h-5 w-5 text-blue-500 fill-blue-500" />}
                      </div>
                      {conv.lastMessage && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(conv.lastMessage.created_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.lastMessage?.content || "Start a conversation"}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No messages yet</h3>
            <p className="text-sm text-muted-foreground">Visit a user's profile and click Message to start chatting</p>
          </Card>
        )}
      </div>
    </div>
  )
}
