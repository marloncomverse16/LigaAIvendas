-- Adiciona colunas necessárias para integração com Meta API no WhatsApp

-- Verificar se a coluna já existe na tabela users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='users' AND column_name='meta_phone_number_id') THEN
        ALTER TABLE users ADD COLUMN meta_phone_number_id TEXT;
        RAISE NOTICE 'Coluna meta_phone_number_id adicionada à tabela users';
    ELSE
        RAISE NOTICE 'Coluna meta_phone_number_id já existe na tabela users';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='users' AND column_name='meta_connected') THEN
        ALTER TABLE users ADD COLUMN meta_connected BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Coluna meta_connected adicionada à tabela users';
    ELSE
        RAISE NOTICE 'Coluna meta_connected já existe na tabela users';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='users' AND column_name='meta_connected_at') THEN
        ALTER TABLE users ADD COLUMN meta_connected_at TIMESTAMP;
        RAISE NOTICE 'Coluna meta_connected_at adicionada à tabela users';
    ELSE
        RAISE NOTICE 'Coluna meta_connected_at já existe na tabela users';
    END IF;
END
$$;

-- Verificar se a coluna já existe na tabela user_servers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='user_servers' AND column_name='meta_phone_number_id') THEN
        ALTER TABLE user_servers ADD COLUMN meta_phone_number_id TEXT;
        RAISE NOTICE 'Coluna meta_phone_number_id adicionada à tabela user_servers';
    ELSE
        RAISE NOTICE 'Coluna meta_phone_number_id já existe na tabela user_servers';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='user_servers' AND column_name='meta_connected') THEN
        ALTER TABLE user_servers ADD COLUMN meta_connected BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Coluna meta_connected adicionada à tabela user_servers';
    ELSE
        RAISE NOTICE 'Coluna meta_connected já existe na tabela user_servers';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='user_servers' AND column_name='meta_connected_at') THEN
        ALTER TABLE user_servers ADD COLUMN meta_connected_at TIMESTAMP;
        RAISE NOTICE 'Coluna meta_connected_at adicionada à tabela user_servers';
    ELSE
        RAISE NOTICE 'Coluna meta_connected_at já existe na tabela user_servers';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='user_servers' AND column_name='updated_at') THEN
        ALTER TABLE user_servers ADD COLUMN updated_at TIMESTAMP;
        RAISE NOTICE 'Coluna updated_at adicionada à tabela user_servers';
    ELSE
        RAISE NOTICE 'Coluna updated_at já existe na tabela user_servers';
    END IF;
END
$$;

-- Verificar se a tabela user_servers existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_servers') THEN
        RAISE NOTICE 'A tabela user_servers não existe';
    ELSE
        RAISE NOTICE 'A tabela user_servers existe';
        
        -- Exibir estrutura atual da tabela
        RAISE NOTICE 'Estrutura atual da tabela user_servers:';
    END IF;
END
$$;

-- Listar todas as colunas da tabela user_servers para diagnóstico
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_servers' 
ORDER BY ordinal_position;

-- Adicionar colunas necessárias para Meta API na tabela servers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='servers' AND column_name='whatsapp_meta_token') THEN
        ALTER TABLE servers ADD COLUMN whatsapp_meta_token TEXT;
        RAISE NOTICE 'Coluna whatsapp_meta_token adicionada à tabela servers';
    ELSE
        RAISE NOTICE 'Coluna whatsapp_meta_token já existe na tabela servers';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='servers' AND column_name='whatsapp_meta_business_id') THEN
        ALTER TABLE servers ADD COLUMN whatsapp_meta_business_id TEXT;
        RAISE NOTICE 'Coluna whatsapp_meta_business_id adicionada à tabela servers';
    ELSE
        RAISE NOTICE 'Coluna whatsapp_meta_business_id já existe na tabela servers';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='servers' AND column_name='whatsapp_meta_api_version') THEN
        ALTER TABLE servers ADD COLUMN whatsapp_meta_api_version TEXT DEFAULT 'v18.0';
        RAISE NOTICE 'Coluna whatsapp_meta_api_version adicionada à tabela servers';
    ELSE
        RAISE NOTICE 'Coluna whatsapp_meta_api_version já existe na tabela servers';
    END IF;
END
$$;