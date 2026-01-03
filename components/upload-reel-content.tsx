"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Upload, X, Play } from "lucide-react"

export function UploadReelContent({ userId }: { userId: string }) {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const router = useRouter()
  const supabase = createBrowserClient()

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("video/")) {
      alert("Please select a video file")
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      alert("Video size must be less than 100MB")
      return
    }

    setVideoFile(file)
    const url = URL.createObjectURL(file)
    setVideoPreview(url)
  }

  const clearVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview)
    }
    setVideoFile(null)
    setVideoPreview(null)
    setIsPlaying(false)
  }

  const togglePlayPause = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleUpload = async () => {
    if (!videoFile) {
      alert("Please select a video")
      return
    }

    if (!caption.trim()) {
      alert("Please add a caption")
      return
    }

    setIsUploading(true)

    try {
      console.log("[v0] Starting video upload process...")
      console.log("[v0] Video file:", videoFile.name, videoFile.size, "bytes")

      const formData = new FormData()
      formData.append("file", videoFile)
      formData.append("filename", `reels/${userId}/${Date.now()}-${videoFile.name}`)

      console.log("[v0] Calling upload API route...")
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] Upload failed:", errorData)
        alert(errorData.error || "Upload failed. Please try again.")
        setIsUploading(false)
        return
      }

      const result = await response.json()
      console.log("[v0] Upload result:", result)

      if (!result.success || !result.url) {
        console.error("[v0] Upload failed:", result.error)
        alert(result.error || "Upload failed. Please try again.")
        setIsUploading(false)
        return
      }

      console.log("[v0] Video uploaded successfully to:", result.url)

      // Process hashtags
      const hashtagArray = hashtags
        .split(/[\s,]+/)
        .filter((tag) => tag.startsWith("#"))
        .map((tag) => tag.toLowerCase())

      // Combine caption with hashtags
      const fullCaption = `${caption.trim()}\n\n${hashtagArray.join(" ")}`

      // Create post
      console.log("[v0] Creating reel post in database...")
      const { error: postError } = await supabase.from("posts").insert({
        user_id: userId,
        content: fullCaption,
        video_url: result.url,
      })

      if (postError) {
        console.error("[v0] Error creating post:", postError)
        alert("Failed to create reel post. Please try again.")
        setIsUploading(false)
        return
      }

      console.log("[v0] Reel posted successfully!")
      alert("Reel uploaded successfully!")
      router.push("/reels")
    } catch (error) {
      console.error("[v0] Upload error:", error)
      alert(`Upload error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="transition-transform duration-200 active:scale-95 hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Upload Reel</h1>
        </div>

        {/* Video Upload */}
        {!videoPreview ? (
          <div className="border-2 border-dashed rounded-lg p-12 text-center mb-6 transition-all duration-200 hover:border-primary hover:bg-muted/50">
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoChange}
              className="hidden"
              id="video-upload"
              disabled={isUploading}
            />
            <label htmlFor="video-upload" className="cursor-pointer">
              <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-semibold mb-2">Choose a video to upload</p>
              <p className="text-sm text-muted-foreground">Max size: 100MB</p>
            </label>
          </div>
        ) : (
          <div className="relative mb-6 rounded-lg overflow-hidden bg-black aspect-[9/16] max-h-[600px] mx-auto animate-in fade-in zoom-in duration-300">
            <video
              ref={videoRef}
              src={videoPreview}
              className="w-full h-full object-contain"
              loop
              playsInline
              onClick={togglePlayPause}
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/50 rounded-full p-8">
                  <Play className="h-16 w-16 text-white" />
                </div>
              </div>
            )}
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-4 right-4 transition-all duration-200 hover:scale-110 active:scale-90"
              onClick={clearVideo}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Caption */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm font-semibold mb-2 block">Caption</label>
            <Textarea
              placeholder="Write a caption for your reel..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={isUploading}
              className="resize-none h-32 transition-all duration-200 focus:scale-[1.01]"
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block">Hashtags</label>
            <Input
              placeholder="#trending #viral #fyp"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              disabled={isUploading}
              className="transition-all duration-200 focus:scale-[1.01]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Separate hashtags with spaces or commas. Must start with #
            </p>
          </div>
        </div>

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!videoFile || !caption.trim() || isUploading}
          className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          size="lg"
        >
          {isUploading ? "Uploading..." : "Upload Reel"}
        </Button>

        {(!videoFile || !caption.trim()) && !isUploading && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            {!videoFile && "Please select a video. "}
            {!caption.trim() && "Please add a caption."}
          </p>
        )}
      </div>
    </div>
  )
}
