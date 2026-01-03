-- Allow messages to have null content when they contain attachments
ALTER TABLE messages 
ALTER COLUMN content DROP NOT NULL;

-- Add a constraint to ensure either content or attachment exists
ALTER TABLE messages 
ADD CONSTRAINT content_or_attachment_required 
CHECK (
  (content IS NOT NULL AND content != '') OR 
  (attachment_url IS NOT NULL)
);
