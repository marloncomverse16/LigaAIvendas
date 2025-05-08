-- Adicionar colunas para suporte à Meta API
ALTER TABLE user_servers 
ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS meta_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS meta_connected_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Confirmar que as colunas foram adicionadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_servers' 
AND column_name IN ('meta_phone_number_id', 'meta_connected', 'meta_connected_at', 'updated_at');