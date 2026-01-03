"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { ArrowLeft, User, MessageSquare } from "lucide-react"
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
          console.log("[v0] Conversation participants changed, reloading...")
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
          console.log("[v0] New message received, reloading conversations...")
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
    console.log("[v0] Loading conversations for user:", userId)
    setLoading(true)

    try {
      const { data: userConvs, error: convsError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId)

      if (convsError) {
        console.error("[v0] Error fetching conversations:", convsError)
        setLoading(false)
        return
      }

      console.log("[v0] User participates in", userConvs?.length || 0, "conversations")

      if (!userConvs || userConvs.length === 0) {
        setConversations([])
        setLoading(false)
        return
      }

      const conversationMap = new Map<string, ConversationWithDetails>()

      for (const conv of userConvs) {
        console.log("[v0] Loading conversation:", conv.conversation_id)

        // Get conversation
        const { data: conversation, error: convError } = await supabase
          .from("conversations")
          .select("*")
          .eq("id", conv.conversation_id)
          .single()

        if (convError) {
          console.error("[v0] Error fetching conversation:", convError)
          continue
        }

        // Get other participant
        const { data: otherParticipant, error: partError } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", conv.conversation_id)
          .neq("user_id", userId)
          .single()

        if (partError) {
          console.error("[v0] Error fetching other participant:", partError)
          continue
        }

        if (!otherParticipant) {
          console.log("[v0] No other participant found for conversation:", conv.conversation_id)
          continue
        }

        // Get other user's profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", otherParticipant.user_id)
          .single()

        if (profileError) {
          console.error("[v0] Error fetching profile:", profileError)
          continue
        }

        const { data: messages, error: messagesError } = await supabase
          .from("direct_messages")
          .select("content, created_at")
          .eq("conversation_id", conv.conversation_id)
          .order("created_at", { ascending: false })

        if (messagesError) {
          console.error("[v0] Error fetching messages:", messagesError)
          continue
        }

        const hasMessages = messages && messages.length > 0

        const { data: followRelationship, error: followError } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", userId)
          .eq("following_id", otherParticipant.user_id)
          .maybeSingle()

        if (followError) {
          console.error("[v0] Error checking follow relationship:", followError)
        }

        const isFollowing = !!followRelationship

        if (!hasMessages && !isFollowing) {
          console.log("[v0] Skipping conversation - no messages and not following:", profile.username)
          continue
        }

        const lastMessage = messages?.[0]

        if (conversation && profile) {
          const conversationDetail: ConversationWithDetails = {
            conversation,
            otherUser: profile,
            lastMessage: lastMessage || undefined,
          }

          const existingConv = conversationMap.get(otherParticipant.user_id)
          const currentTime = lastMessage?.created_at || conversation.created_at
          const existingTime = existingConv?.lastMessage?.created_at || existingConv?.conversation.created_at

          if (!existingConv || (existingTime && new Date(currentTime).getTime() > new Date(existingTime).getTime())) {
            console.log("[v0] Added/Updated conversation with", profile.username)
            conversationMap.set(otherParticipant.user_id, conversationDetail)
          } else {
            console.log("[v0] Skipped duplicate conversation with", profile.username)
          }
        }
      }

      const conversationDetails = Array.from(conversationMap.values()).sort((a, b) => {
        const timeA = a.lastMessage?.created_at || a.conversation.created_at
        const timeB = b.lastMessage?.created_at || b.conversation.created_at
        return new Date(timeB).getTime() - new Date(timeA).getTime()
      })

      console.log("[v0] Total unique conversations loaded:", conversationDetails.length)
      setConversations(conversationDetails)
    } catch (error) {
      console.error("[v0] Unexpected error loading conversations:", error)
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
                      <h3 className="font-semibold">{conv.otherUser.display_name}</h3>
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
