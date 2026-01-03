-- Remove DM notifications from the main notifications system
-- DMs will only show badge on Messages tab

-- Update the DM notification trigger to NOT create notifications
DROP TRIGGER IF EXISTS dm_notification_trigger ON public.direct_messages;
DROP FUNCTION IF EXISTS create_dm_notification();

-- DMs are now tracked only through unread message counts
-- No notifications table entries for DMs

-- Keep other notification triggers (follow, like, comment) as they are
