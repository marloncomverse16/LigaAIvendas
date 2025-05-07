-- Criação da tabela de agentes IA por servidor
CREATE TABLE IF NOT EXISTS server_ai_agents (
  id SERIAL PRIMARY KEY,
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  webhook_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- Índice para otimizar buscas por servidor
CREATE INDEX idx_server_ai_agents_server_id ON server_ai_agents(server_id);

-- Migrar os dados existentes da tabela de servidores para a nova estrutura
INSERT INTO server_ai_agents (server_id, name, webhook_url, active, created_at)
SELECT 
  id as server_id, 
  COALESCE(ai_agent_name, 'Agente IA Principal') as name, 
  ai_agent_webhook_url as webhook_url,
  active,
  created_at
FROM servers
WHERE ai_agent_name IS NOT NULL OR ai_agent_webhook_url IS NOT NULL;

-- Note: Mantemos as colunas ai_agent_name e ai_agent_webhook_url na tabela servers por compatibilidade,
-- mas vamos usar a nova tabela server_ai_agents para novos registros