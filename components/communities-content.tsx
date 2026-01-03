"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Users, Hash } from "lucide-react"
import { useRouter } from "next/navigation"

interface ChatRoom {
  id: string
  name: string
  description: string | null
  created_at: string
}

export function CommunitiesContent({ userId }: { userId: string }) {
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])

  useEffect(() => {
    loadRooms()
  }, [])

  const loadRooms = async () => {
    const { data } = await supabase.from("chat_rooms").select("*").order("created_at", { ascending: true })
    if (data) setRooms(data)
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
            <h1 className="text-xl font-bold">Communities</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl py-6">
        <div className="space-y-3">
          {rooms.map((room) => (
            <Card
              key={room.id}
              className="p-4 cursor-pointer hover:bg-muted/50 transition-all active:scale-[0.99]"
              onClick={() => router.push(`/communities/${room.id}`)}
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Hash className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{room.name}</h3>
                  {room.description && <p className="text-sm text-muted-foreground">{room.description}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {rooms.length === 0 && (
          <Card className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No communities yet</h3>
            <p className="text-sm text-muted-foreground">Communities will appear here when they are created</p>
          </Card>
        )}
      </div>
    </div>
  )
}
