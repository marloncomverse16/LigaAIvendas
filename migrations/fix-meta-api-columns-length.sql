-- Migração para corrigir o tamanho dos campos de Meta API
-- Os tokens da Meta API são mais longos que 50 caracteres (limite atual)

-- Altera o tipo de coluna para text (sem limite de tamanho)
ALTER TABLE settings 
  ALTER COLUMN whatsapp_meta_token TYPE TEXT,
  ALTER COLUMN whatsapp_meta_business_id TYPE TEXT,
  ALTER COLUMN whatsapp_meta_api_version TYPE TEXT;

-- Atualiza índices se necessário
REINDEX TABLE settings;

-- Verifica se as colunas existem
DO $$
BEGIN
  -- Adiciona colunas created_at e updated_at se não existirem
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'created_at') THEN
    ALTER TABLE settings ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'updated_at') THEN
    ALTER TABLE settings ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;