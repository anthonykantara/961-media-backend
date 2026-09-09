CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL UNIQUE,
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  display_name VARCHAR(255),
  identity_provider VARCHAR(32) NOT NULL DEFAULT 'otp',
  identity_subject VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_role_check CHECK (role IN ('user', 'contributor', 'editor', 'admin'))
);
CREATE UNIQUE INDEX IF NOT EXISTS users_identity_provider_subject_idx ON users(identity_provider, identity_subject) WHERE identity_subject IS NOT NULL;
CREATE TABLE IF NOT EXISTS auth_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, code_hash CHAR(64) NOT NULL, expires_at TIMESTAMP WITH TIME ZONE NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS auth_otps_user_created_idx ON auth_otps(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_otps_active_idx ON auth_otps(user_id, expires_at) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS users_email_active_idx ON users(email) WHERE is_active = TRUE;
