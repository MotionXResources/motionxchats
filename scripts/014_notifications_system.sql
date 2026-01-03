-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'follow', 'like', 'comment', 'message'
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notifications" 
  ON public.notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" 
  ON public.notifications FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" 
  ON public.notifications FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" 
  ON public.notifications FOR DELETE 
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to automatically create follow notification
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, from_user_id)
  VALUES (NEW.following_id, 'follow', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for follows
DROP TRIGGER IF EXISTS follow_notification_trigger ON public.follows;
CREATE TRIGGER follow_notification_trigger
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION create_follow_notification();

-- Create function to automatically create like notification
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id UUID;
BEGIN
  -- Get the post author
  SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
  
  -- Don't create notification if user liked their own post
  IF post_author_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, from_user_id, post_id)
    VALUES (post_author_id, 'like', NEW.user_id, NEW.post_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for likes
DROP TRIGGER IF EXISTS like_notification_trigger ON public.likes;
CREATE TRIGGER like_notification_trigger
  AFTER INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION create_like_notification();

-- Create function to automatically create comment notification
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id UUID;
BEGIN
  -- Get the post author
  SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
  
  -- Don't create notification if user commented on their own post
  IF post_author_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, from_user_id, post_id, comment_id)
    VALUES (post_author_id, 'comment', NEW.user_id, NEW.post_id, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for comments
DROP TRIGGER IF EXISTS comment_notification_trigger ON public.comments;
CREATE TRIGGER comment_notification_trigger
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_notification();
