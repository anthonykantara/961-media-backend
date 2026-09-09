-- CMS messages received from the public contact/reader intake layer.
CREATE TABLE IF NOT EXISTS cms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name VARCHAR(255) NOT NULL DEFAULT '',
  sender_email VARCHAR(255) NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  category VARCHAR(50) NOT NULL DEFAULT 'General',
  unread BOOLEAN NOT NULL DEFAULT true,
  starred BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cms_messages_created_at ON cms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_messages_unread ON cms_messages(unread);
CREATE INDEX IF NOT EXISTS idx_cms_messages_starred ON cms_messages(starred);
