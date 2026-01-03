"use client"

import type React from "react"

import { useState, useEffect, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, Send, Hash, Paperclip, X, Settings, ArrowLeft } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { ProfileSettings } from "@/components/profile-settings"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { uploadFile } from "@/app/actions/upload"

type Profile = {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  bio?: string
  created_at: string
}

type ChatRoom = {
  id: string
  name: string
  description?: string
  created_by?: string
  created_at: string
}

type Message = {
  id: string
  room_id: string
  user_id: string
  content: string
  attachment_url?: string
  attachment_type?: string
  created_at: string
  profiles?: Profile
}

type ChatInterfaceProps = {
  user: User
  profile: Profile | null
  initialRoomId?: string
}

export function ChatInterface({ user, profile: initialProfile, initialRoomId }: ChatInterfaceProps) {
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [profile, setProfile] = useState(initialProfile)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageIds = useRef(new Set<string>())

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!selectedRoom) return

    messageIds.current.clear()

    const fetchMessages = async () => {
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", selectedRoom.id)
        .order("created_at", { ascending: true })

      if (messagesError) {
        console.error("Error fetching messages:", messagesError)
        return
      }

      if (!messagesData) {
        setMessages([])
        return
      }

      const userIds = [...new Set(messagesData.map((m) => m.user_id))]
      const { data: profilesData, error: profilesError } = await supabase.from("profiles").select("*").in("id", userIds)

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError)
      }

      const messagesWithProfiles = messagesData.map((msg) => ({
        ...msg,
        profiles: profilesData?.find((p) => p.id === msg.user_id),
      }))

      messagesWithProfiles.forEach((msg) => messageIds.current.add(msg.id))
      setMessages(messagesWithProfiles)
    }

    fetchMessages()

    const channel = supabase
      .channel(`room:${selectedRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${selectedRoom.id}`,
        },
        async (payload) => {
          const messageId = payload.new.id as string

          if (messageIds.current.has(messageId)) {
            return
          }

          messageIds.current.add(messageId)

          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", payload.new.user_id)
            .single()

          const newMsg = {
            ...payload.new,
            profiles: profileData,
          } as Message

          setMessages((prev) => [...prev, newMsg])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedRoom, supabase])

  useEffect(() => {
    const loadRooms = async () => {
      const { data } = await supabase.from("chat_rooms").select("*").order("created_at", { ascending: true })
      if (data) {
        setRooms(data)
        if (initialRoomId) {
          const room = data.find((r) => r.id === initialRoomId)
          setSelectedRoom(room || data[0] || null)
        } else {
          setSelectedRoom(data[0] || null)
        }
      }
    }
    loadRooms()
  }, [initialRoomId])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"]
    if (!validTypes.includes(file.type)) {
      alert("Please select an image (JPEG, PNG, GIF, WebP) or video (MP4, WebM)")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB")
      return
    }

    setSelectedFile(file)
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!newMessage.trim() && !selectedFile) || !selectedRoom || isLoading) return

    setIsLoading(true)
    try {
      let attachmentUrl: string | undefined
      let attachmentType: string | undefined

      if (selectedFile) {
        setUploadingFile(true)
        const formData = new FormData()
        formData.append("file", selectedFile)
        formData.append(
          "filename",
          `attachments/${selectedRoom.id}/${user.id}-${Date.now()}.${selectedFile.name.split(".").pop()}`,
        )

        const result = await uploadFile(formData)

        if (result.error) {
          console.error("Upload failed:", result.error)
          alert(`Upload failed: ${result.error}`)
          setUploadingFile(false)
          setIsLoading(false)
          return
        }

        attachmentUrl = result.url
        attachmentType = selectedFile.type.startsWith("image/") ? "image" : "video"
        setUploadingFile(false)
      }

      const { data, error } = await supabase
        .from("messages")
        .insert({
          room_id: selectedRoom.id,
          user_id: user.id,
          content: newMessage.trim() || (selectedFile ? null : ""), // Allow null content when attachment exists
          attachment_url: attachmentUrl,
          attachment_type: attachmentType,
        })
        .select()
        .single()

      if (error) {
        console.error("Error sending message:", error)
        alert(`Error sending message: ${error.message}`)
      } else {
        setNewMessage("")
        handleRemoveFile()
      }
    } catch (error) {
      console.error("Exception sending message:", error)
      alert("Failed to send message")
    } finally {
      setIsLoading(false)
      setUploadingFile(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const handleProfileUpdate = () => {
    setShowSettings(false)
    router.refresh()
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data)
      })
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/communities")}
              className="transition-transform active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold text-lg">Communities</h2>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {profile && (
            <button
              onClick={() => setShowSettings(true)}
              className="mt-3 w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-all active:scale-95"
            >
              <Avatar className="h-8 w-8">
                {profile.avatar_url ? (
                  <AvatarImage src={profile.avatar_url || "/placeholder.svg"} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="w-5 h-5 text-muted-foreground"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {getInitials(profile.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">{profile.display_name}</div>
                <div className="text-xs text-muted-foreground">@{profile.username}</div>
              </div>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            <div className="text-xs font-semibold text-muted-foreground px-2 mb-2">CHAT ROOMS</div>
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-all duration-200 flex items-center gap-2 active:scale-95 ${
                  selectedRoom?.id === room.id ? "bg-accent" : ""
                }`}
              >
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{room.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <h1 className="font-semibold text-xl">{selectedRoom.name}</h1>
              </div>
              {selectedRoom.description && (
                <p className="text-sm text-muted-foreground mt-1">{selectedRoom.description}</p>
              )}
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Avatar className="h-10 w-10">
                      {message.profiles?.avatar_url ? (
                        <AvatarImage src={message.profiles.avatar_url || "/placeholder.svg"} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="w-6 h-6 text-muted-foreground"
                          >
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(message.profiles?.display_name || "Unknown")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold">{message.profiles?.display_name || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {message.content && <p className="text-sm mt-1 leading-relaxed">{message.content}</p>}
                      {message.attachment_url && (
                        <div className="mt-2">
                          {message.attachment_type === "image" ? (
                            <img
                              src={message.attachment_url || "/placeholder.svg"}
                              alt="Attachment"
                              className="rounded-lg max-w-sm max-h-96 object-cover border"
                            />
                          ) : message.attachment_type === "video" ? (
                            <video
                              src={message.attachment_url}
                              controls
                              className="rounded-lg max-w-sm max-h-96 border"
                            />
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <form onSubmit={handleSendMessage} className="p-4 border-t">
              {selectedFile && (
                <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-md">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                    className="h-6 w-6 transition-transform active:scale-95"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || uploadingFile}
                  className="transition-all duration-200 active:scale-90"
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message #${selectedRoom.name}`}
                  disabled={isLoading || uploadingFile}
                  className="flex-1 transition-all duration-200 focus-visible:scale-[1.01]"
                />
                <Button
                  type="submit"
                  disabled={isLoading || uploadingFile || (!newMessage.trim() && !selectedFile)}
                  className="transition-all duration-200 active:scale-90"
                >
                  {uploadingFile ? "..." : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a chat room to start messaging
          </div>
        )}
      </div>

      {showSettings && profile && <ProfileSettings profile={profile} onClose={handleProfileUpdate} />}
    </div>
  )
}
