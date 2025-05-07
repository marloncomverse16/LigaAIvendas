-- Criação da tabela de associação entre usuários e agentes IA
CREATE TABLE IF NOT EXISTS user_ai_agents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES server_ai_agents(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- Índices para otimizar buscas
CREATE INDEX idx_user_ai_agents_user_id ON user_ai_agents(user_id);
CREATE INDEX idx_user_ai_agents_agent_id ON user_ai_agents(agent_id);

-- Evitar duplicatas
CREATE UNIQUE INDEX idx_user_agent_unique ON user_ai_agents(user_id, agent_id);

-- Garantir que cada usuário tenha apenas um agente padrão
CREATE UNIQUE INDEX idx_user_default_agent ON user_ai_agents(user_id) WHERE is_default = true;