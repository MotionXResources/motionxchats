-- Create function to automatically create message notification
CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  other_user_id UUID;
BEGIN
  -- Get the other participant in the conversation
  SELECT user_id INTO other_user_id
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.user_id
  LIMIT 1;
  
  -- Create notification for the other user
  IF other_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, from_user_id, conversation_id)
    VALUES (other_user_id, 'message', NEW.user_id, NEW.conversation_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for direct messages
DROP TRIGGER IF EXISTS message_notification_trigger ON public.direct_messages;
CREATE TRIGGER message_notification_trigger
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_notification();
