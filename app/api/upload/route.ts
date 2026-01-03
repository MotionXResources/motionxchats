import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Server: Starting file upload...")
    const formData = await request.formData()
    const file = formData.get("file") as File
    const filename = formData.get("filename") as string

    if (!file) {
      console.error("[v0] Server: No file provided")
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
    }

    console.log("[v0] Server: File received:", file.name, file.size, "bytes")

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("[v0] Server: BLOB_READ_WRITE_TOKEN is not configured")
      return NextResponse.json({ success: false, error: "Upload service not configured" }, { status: 500 })
    }

    console.log("[v0] Server: Uploading to:", filename)

    const blob = await put(filename, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    console.log("[v0] Server: Upload successful, URL:", blob.url)

    return NextResponse.json({
      success: true,
      url: blob.url,
    })
  } catch (error) {
    console.error("[v0] Server: Upload error:", error)
    const errorMessage = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    )
  }
}
