"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { uploadFile } from "@/app/actions/upload"
import { X, Upload, Loader2, Shield } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface ProfileSettingsProps {
  profile: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    bio?: string
    likes_private?: boolean
    followers_private?: boolean
    allow_dm_from?: string
  }
  onClose: () => void
}

export function ProfileSettings({ profile, onClose }: ProfileSettingsProps) {
  const [username, setUsername] = useState(profile.username)
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bio, setBio] = useState(profile.bio || "")
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [likesPrivate, setLikesPrivate] = useState(profile.likes_private || false)
  const [followersPrivate, setFollowersPrivate] = useState(profile.followers_private || false)
  const [allowDmFrom, setAllowDmFrom] = useState(profile.allow_dm_from || "everyone")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file")
      return
    }

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("filename", `avatars/${profile.id}-${Date.now()}.${file.name.split(".").pop()}`)

      const result = await uploadFile(formData)

      if (result.error) {
        throw new Error(result.error)
      }

      setAvatarUrl(result.url)
    } catch (error) {
      console.error("Avatar upload error:", error)
      alert("Failed to upload avatar")
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username,
          display_name: displayName,
          bio,
          avatar_url: avatarUrl,
          likes_private: likesPrivate,
          followers_private: followersPrivate,
          allow_dm_from: allowDmFrom,
        })
        .eq("id", profile.id)

      if (error) throw error

      router.refresh()
      onClose()
    } catch (error) {
      console.error("Profile update error:", error)
      alert("Failed to update profile")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background z-10">
          <h2 className="text-xl font-semibold">Edit Profile</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="transition-transform active:scale-95">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl || "/placeholder.svg"} />
              <AvatarFallback className="text-2xl">{displayName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <Label htmlFor="avatar-upload" className="cursor-pointer">
              <div className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-md transition-all active:scale-95">
                {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span className="text-sm">{uploadingAvatar ? "Uploading..." : "Change Avatar"}</span>
              </div>
              <Input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="transition-all focus:scale-[1.02]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="transition-all focus:scale-[1.02]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              className="resize-none transition-all focus:scale-[1.02]"
              rows={3}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Privacy Settings</h3>
            </div>

            <div className="space-y-4 pl-7">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="likes-private" className="text-sm font-medium">
                    Private Likes
                  </Label>
                  <p className="text-xs text-muted-foreground">Only you can see what posts you've liked</p>
                </div>
                <Switch id="likes-private" checked={likesPrivate} onCheckedChange={setLikesPrivate} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="followers-private" className="text-sm font-medium">
                    Private Followers
                  </Label>
                  <p className="text-xs text-muted-foreground">Only you can see your followers and following lists</p>
                </div>
                <Switch id="followers-private" checked={followersPrivate} onCheckedChange={setFollowersPrivate} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dm-permissions" className="text-sm font-medium">
                  Who can message you
                </Label>
                <Select value={allowDmFrom} onValueChange={setAllowDmFrom}>
                  <SelectTrigger id="dm-permissions">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="followers">People you follow</SelectItem>
                    <SelectItem value="none">No one</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Control who can start conversations with you</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-6 border-t sticky bottom-0 bg-background">
          <Button variant="outline" onClick={onClose} className="transition-transform active:scale-95 bg-transparent">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="transition-transform active:scale-95">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
