"use client"

import type React from "react"

import { useEffect, useMemo, useState, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Send, Paperclip, X, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { uploadFile } from "@/app/actions/upload"

interface Message {
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

export function ConversationContent({ conversationId, userId }: { conversationId: string; userId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null)
  const [attachmentType, setAttachmentType] = useState<"image" | "video" | null>(null)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])

  useEffect(() => {
    loadOtherUser()
    loadMessages()

    // Subscribe to new messages
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => [...prev, newMsg])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadOtherUser = async () => {
    const { data: otherParticipant } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", userId)
      .single()

    if (otherParticipant) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", otherParticipant.user_id).single()
      if (profile) setOtherUser(profile)
    }
  }

  const loadMessages = async () => {
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (data) setMessages(data)
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

  const handleSend = async () => {
    if (!newMessage.trim() && !attachmentFile) return

    setIsSending(true)
    try {
      let imageUrl: string | null = null
      let videoUrl: string | null = null

      if (attachmentFile) {
        const formData = new FormData()
        formData.append("file", attachmentFile)
        formData.append("filename", `messages/${Date.now()}-${attachmentFile.name}`)

        const result = await uploadFile(formData)
        if (result.error) {
          alert(result.error)
          setIsSending(false)
          return
        }

        if (attachmentType === "image") {
          imageUrl = result.url
        } else if (attachmentType === "video") {
          videoUrl = result.url
        }
      }

      const { error: messageError } = await supabase.from("direct_messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        content: newMessage.trim() || null,
        image_url: imageUrl,
        video_url: videoUrl,
      })

      if (messageError) {
        console.error("[v0] Error inserting message:", messageError)
        alert("Failed to send message")
        setIsSending(false)
        return
      }

      console.log("[v0] Message sent successfully")

      setNewMessage("")
      clearAttachment()
    } catch (error) {
      console.error("[v0] Error sending message:", error)
      alert("An error occurred while sending the message")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/messages")}
              className="transition-transform active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {otherUser && (
              <div
                className="flex items-center gap-3 flex-1 cursor-pointer"
                onClick={() => router.push(`/profile/${otherUser.id}`)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={otherUser.avatar_url || ""} />
                  <AvatarFallback className="bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{otherUser.display_name}</h3>
                  <p className="text-sm text-muted-foreground">@{otherUser.username}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-4 max-w-2xl space-y-4">
          {messages.map((message) => {
            const isOwn = message.user_id === userId
            return (
              <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"} rounded-lg p-3`}
                >
                  {message.content && <p className="text-pretty whitespace-pre-wrap">{message.content}</p>}

                  {message.image_url && (
                    <div className="mt-2 rounded overflow-hidden">
                      <img
                        src={message.image_url || "/placeholder.svg"}
                        alt="Attachment"
                        className="w-full max-h-64 object-cover"
                      />
                    </div>
                  )}

                  {message.video_url && (
                    <div className="mt-2 rounded overflow-hidden">
                      <video src={message.video_url} controls className="w-full max-h-64" />
                    </div>
                  )}

                  <p className={`text-xs mt-1 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-background">
        <div className="container mx-auto px-4 py-4 max-w-2xl">
          {attachmentPreview && (
            <div className="relative mb-3 rounded-lg overflow-hidden border inline-block">
              <Button size="icon" variant="secondary" className="absolute top-2 right-2 z-10" onClick={clearAttachment}>
                <X className="h-4 w-4" />
              </Button>
              {attachmentType === "image" ? (
                <img src={attachmentPreview || "/placeholder.svg"} alt="Preview" className="max-h-32 object-cover" />
              ) : (
                <video src={attachmentPreview} className="max-h-32" />
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button size="icon" variant="ghost" className="relative" disabled={isSending}>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleAttachmentChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isSending}
              />
              <Paperclip className="h-5 w-5" />
            </Button>

            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              disabled={isSending}
              className="flex-1"
            />

            <Button onClick={handleSend} disabled={(!newMessage.trim() && !attachmentFile) || isSending}>
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
