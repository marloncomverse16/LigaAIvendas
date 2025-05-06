-- Adicionar campo maxUsers à tabela servers
ALTER TABLE servers ADD COLUMN max_users INTEGER DEFAULT 10;