import { Button } from "@/components/ui/button"
import { Heart, MessageCircle, Users } from "lucide-react"
import Link from "next/link"

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center text-center gap-8 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-700">
            <MessageCircle className="h-12 w-12" />
            <h1 className="text-5xl font-bold tracking-tight">MotionX</h1>
          </div>

          <p className="text-xl text-muted-foreground text-balance animate-in fade-in slide-in-from-top-4 duration-700 delay-100">
            Share your thoughts, connect with friends, and join communities. The social platform built for real
            conversations.
          </p>

          <div className="flex gap-4 mt-4 animate-in fade-in slide-in-from-top-4 duration-700 delay-200">
            <Button asChild size="lg" className="transition-all duration-200 hover:scale-105 active:scale-95">
              <Link href="/auth/sign-up">Get Started</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="transition-all duration-200 hover:scale-105 active:scale-95 bg-transparent"
            >
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12 w-full">
            <div className="flex flex-col items-center gap-3 p-6 rounded-lg border bg-card animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 transition-all hover:scale-105 hover:shadow-lg">
              <Heart className="h-8 w-8" />
              <h3 className="font-semibold">Share & Interact</h3>
              <p className="text-sm text-muted-foreground text-pretty">
                Post updates, photos, and videos. Like, comment, and engage with your community.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 p-6 rounded-lg border bg-card animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 transition-all hover:scale-105 hover:shadow-lg">
              <MessageCircle className="h-8 w-8" />
              <h3 className="font-semibold">Direct Messages</h3>
              <p className="text-sm text-muted-foreground text-pretty">
                Have private conversations with other users in real-time messaging.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 p-6 rounded-lg border bg-card animate-in fade-in slide-in-from-bottom-4 duration-700 delay-700 transition-all hover:scale-105 hover:shadow-lg">
              <Users className="h-8 w-8" />
              <h3 className="font-semibold">Communities</h3>
              <p className="text-sm text-muted-foreground text-pretty">
                Join public chat rooms and connect with people who share your interests.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
