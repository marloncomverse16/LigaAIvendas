-- Script para adicionar ou verificar as colunas para Meta API na tabela user_servers
-- Este script é idempotente e pode ser executado várias vezes sem causar erros

DO $$
BEGIN
    -- Verificar se a coluna meta_phone_number_id existe e criá-la se não existir
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_servers' AND column_name = 'meta_phone_number_id'
    ) THEN
        ALTER TABLE user_servers ADD COLUMN meta_phone_number_id TEXT;
        RAISE NOTICE 'Coluna meta_phone_number_id adicionada à tabela user_servers';
    ELSE
        RAISE NOTICE 'Coluna meta_phone_number_id já existe na tabela user_servers';
    END IF;

    -- Verificar se a coluna meta_connected existe e criá-la se não existir
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_servers' AND column_name = 'meta_connected'
    ) THEN
        ALTER TABLE user_servers ADD COLUMN meta_connected BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Coluna meta_connected adicionada à tabela user_servers';
    ELSE
        RAISE NOTICE 'Coluna meta_connected já existe na tabela user_servers';
    END IF;

    -- Verificar se a coluna meta_connected_at existe e criá-la se não existir
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_servers' AND column_name = 'meta_connected_at'
    ) THEN
        ALTER TABLE user_servers ADD COLUMN meta_connected_at TIMESTAMP;
        RAISE NOTICE 'Coluna meta_connected_at adicionada à tabela user_servers';
    ELSE
        RAISE NOTICE 'Coluna meta_connected_at já existe na tabela user_servers';
    END IF;

    -- Verificar se a coluna updated_at existe e criá-la se não existir
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_servers' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_servers ADD COLUMN updated_at TIMESTAMP;
        RAISE NOTICE 'Coluna updated_at adicionada à tabela user_servers';
    ELSE
        RAISE NOTICE 'Coluna updated_at já existe na tabela user_servers';
    END IF;

END $$;