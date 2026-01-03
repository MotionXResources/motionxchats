"use server"

import { put } from "@vercel/blob"

export async function uploadFile(formData: FormData) {
  try {
    const file = formData.get("file") as File
    if (!file) {
      return { error: "No file provided" }
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("BLOB_READ_WRITE_TOKEN is not configured")
      return { error: "Upload service not configured. Please ensure BLOB_READ_WRITE_TOKEN is set." }
    }

    const filename = formData.get("filename") as string
    const blob = await put(filename, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    return { url: blob.url }
  } catch (error) {
    console.error("Upload error:", error)
    return { error: `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}
