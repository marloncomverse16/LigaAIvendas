-- Adicionando as novas colunas na tabela de usuários
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS whatsapp_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS ai_agent_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS contacts_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS scheduling_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS crm_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS available_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS token_expiration_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS monthly_fee TEXT DEFAULT '0',
ADD COLUMN IF NOT EXISTS server_address TEXT,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();