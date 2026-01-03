"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ArrowLeft, Users, Hash, Plus, Search, Lock, Globe } from "lucide-react"
import { useRouter } from "next/navigation"

interface ChatRoom {
  id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
  is_private: boolean
  banner_url: string | null
  member_count: number
}

interface CommunityWithMembership extends ChatRoom {
  isMember: boolean
}

export function CommunitiesContent({ userId }: { userId: string }) {
  const [communities, setCommunities] = useState<CommunityWithMembership[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [newCommunityName, setNewCommunityName] = useState("")
  const [newCommunityDescription, setNewCommunityDescription] = useState("")
  const [newCommunityPrivate, setNewCommunityPrivate] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])

  useEffect(() => {
    loadCommunities()

    const communitiesChannel = supabase
      .channel("communities-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_rooms" }, () => {
        loadCommunities()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_members" }, () => {
        loadCommunities()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(communitiesChannel)
    }
  }, [])

  const loadCommunities = async () => {
    // Load all visible communities
    const { data: rooms } = await supabase.from("chat_rooms").select("*").order("member_count", { ascending: false })

    if (!rooms) {
      setCommunities([])
      return
    }

    // Check membership for each community
    const roomIds = rooms.map((r) => r.id)
    const { data: memberships } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", userId)
      .in("community_id", roomIds)

    const membershipSet = new Set(memberships?.map((m) => m.community_id) || [])

    const communitiesWithMembership: CommunityWithMembership[] = rooms.map((room) => ({
      ...room,
      isMember: membershipSet.has(room.id),
    }))

    setCommunities(communitiesWithMembership)
  }

  const handleCreateCommunity = async () => {
    if (!newCommunityName.trim()) return

    setIsCreating(true)
    try {
      // Create community
      const { data: newRoom, error: roomError } = await supabase
        .from("chat_rooms")
        .insert({
          name: newCommunityName.trim(),
          description: newCommunityDescription.trim() || null,
          created_by: userId,
          is_private: newCommunityPrivate,
          member_count: 1,
        })
        .select()
        .single()

      if (roomError) throw roomError

      // Add creator as owner
      const { error: memberError } = await supabase.from("community_members").insert({
        community_id: newRoom.id,
        user_id: userId,
        role: "owner",
      })

      if (memberError) throw memberError

      setNewCommunityName("")
      setNewCommunityDescription("")
      setNewCommunityPrivate(false)
      loadCommunities()

      // Navigate to new community
      router.push(`/communities/${newRoom.id}`)
    } catch (error) {
      console.error("Error creating community:", error)
      alert("Failed to create community")
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinCommunity = async (communityId: string) => {
    try {
      const { error } = await supabase.from("community_members").insert({
        community_id: communityId,
        user_id: userId,
        role: "member",
      })

      if (error) throw error

      loadCommunities()
    } catch (error) {
      console.error("Error joining community:", error)
      alert("Failed to join community")
    }
  }

  const handleLeaveCommunity = async (communityId: string) => {
    try {
      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", userId)

      if (error) throw error

      loadCommunities()
    } catch (error) {
      console.error("Error leaving community:", error)
      alert("Failed to leave community")
    }
  }

  const filteredCommunities = communities.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

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

            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="ml-auto transition-transform active:scale-95">
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Community</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      placeholder="Community name"
                      value={newCommunityName}
                      onChange={(e) => setNewCommunityName(e.target.value)}
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      placeholder="What's this community about?"
                      value={newCommunityDescription}
                      onChange={(e) => setNewCommunityDescription(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="private"
                      checked={newCommunityPrivate}
                      onChange={(e) => setNewCommunityPrivate(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <label htmlFor="private" className="text-sm cursor-pointer">
                      Make this community private
                    </label>
                  </div>
                  <Button
                    onClick={handleCreateCommunity}
                    disabled={!newCommunityName.trim() || isCreating}
                    className="w-full"
                  >
                    {isCreating ? "Creating..." : "Create Community"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredCommunities.map((community) => (
            <Card
              key={community.id}
              className="p-4 hover:bg-muted/50 transition-all animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Hash className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg truncate">{community.name}</h3>
                    {community.is_private ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  {community.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{community.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {community.member_count} {community.member_count === 1 ? "member" : "members"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {community.isMember ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => router.push(`/communities/${community.id}`)}
                        className="transition-transform active:scale-95"
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLeaveCommunity(community.id)}
                        className="transition-transform active:scale-95"
                      >
                        Leave
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleJoinCommunity(community.id)}
                      className="transition-transform active:scale-95"
                    >
                      Join
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredCommunities.length === 0 && (
          <Card className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">{searchQuery ? "No communities found" : "No communities yet"}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? "Try a different search term" : "Be the first to create a community"}
            </p>
            {!searchQuery && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Community
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Community</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <Input
                        placeholder="Community name"
                        value={newCommunityName}
                        onChange={(e) => setNewCommunityName(e.target.value)}
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        placeholder="What's this community about?"
                        value={newCommunityDescription}
                        onChange={(e) => setNewCommunityDescription(e.target.value)}
                        maxLength={200}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="private-empty"
                        checked={newCommunityPrivate}
                        onChange={(e) => setNewCommunityPrivate(e.target.checked)}
                        className="cursor-pointer"
                      />
                      <label htmlFor="private-empty" className="text-sm cursor-pointer">
                        Make this community private
                      </label>
                    </div>
                    <Button
                      onClick={handleCreateCommunity}
                      disabled={!newCommunityName.trim() || isCreating}
                      className="w-full"
                    >
                      {isCreating ? "Creating..." : "Create Community"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
