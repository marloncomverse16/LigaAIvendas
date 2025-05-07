-- Adiciona a coluna de nome do agente de IA na tabela de servidores
ALTER TABLE servers ADD COLUMN IF NOT EXISTS ai_agent_name TEXT;