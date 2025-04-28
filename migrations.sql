-- Create AI Agent Tables
CREATE TABLE IF NOT EXISTS "ai_agent" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id"),
  "enabled" BOOLEAN DEFAULT false,
  "trigger_text" TEXT,
  "personality" TEXT,
  "expertise" TEXT,
  "voice_tone" TEXT,
  "rules" TEXT,
  "follow_up_enabled" BOOLEAN DEFAULT false,
  "follow_up_count" INTEGER DEFAULT 0,
  "message_interval" TEXT DEFAULT '30 minutos',
  "follow_up_prompt" TEXT,
  "scheduling_enabled" BOOLEAN DEFAULT false,
  "agenda_id" TEXT,
  "scheduling_prompt_consult" TEXT,
  "scheduling_prompt_time" TEXT,
  "scheduling_duration" TEXT,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ai_agent_steps" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id"),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL,
  "created_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ai_agent_faqs" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id"),
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT now()
);