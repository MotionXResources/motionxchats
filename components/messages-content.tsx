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
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    // Get user's conversations
    const { data: userConvs } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId)

    if (!userConvs) return

    const conversationDetails: ConversationWithDetails[] = []

    for (const conv of userConvs) {
      // Get conversation
      const { data: conversation } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conv.conversation_id)
        .single()

      // Get other participant
      const { data: otherParticipant } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conv.conversation_id)
        .neq("user_id", userId)
        .single()

      if (!otherParticipant) continue

      // Get other user's profile
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", otherParticipant.user_id).single()

      // Get last message
      const { data: lastMessage } = await supabase
        .from("direct_messages")
        .select("content, created_at")
        .eq("conversation_id", conv.conversation_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (conversation && profile) {
        conversationDetails.push({
          conversation,
          otherUser: profile,
          lastMessage: lastMessage || undefined,
        })
      }
    }

    // Sort by last message time
    conversationDetails.sort((a, b) => {
      const timeA = a.lastMessage?.created_at || a.conversation.created_at
      const timeB = b.lastMessage?.created_at || b.conversation.created_at
      return new Date(timeB).getTime() - new Date(timeA).getTime()
    })

    setConversations(conversationDetails)
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
              onClick={() => router.push("/feed")}
              className="transition-transform active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Messages</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl py-4">
        {conversations.length > 0 ? (
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
