-- Add read tracking for messages
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Enable RLS
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

-- Policies for message_reads
CREATE POLICY "Users can view their own read status"
  ON message_reads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own read status"
  ON message_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own read status (update)"
  ON message_reads FOR UPDATE
  USING (user_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_message_reads_conversation_user ON message_reads(conversation_id, user_id);
