"use server"

export async function uploadFile(formData: FormData) {
  try {
    // Call the API route from the server side
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000"

    const response = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false as const,
        error: errorData.error || "Upload failed",
      }
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error("[v0] Server action upload error:", error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Upload failed",
    }
  }
}
