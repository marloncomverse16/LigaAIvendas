import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { Pool } from "pg";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  // Gerar hash para a senha "senha123"
  const hashedPassword = await hashPassword("senha123");
  console.log("Hash:", hashedPassword);

  // Conectar ao banco de dados
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Inserir novo usuário
    const res = await pool.query(
      `INSERT INTO users (username, email, password, name, company, phone, bio, avatar_url, whatsapp_webhook_url, prospecting_webhook_url, ai_agent_webhook_url, contacts_webhook_url, scheduling_webhook_url, crm_webhook_url, available_tokens, is_admin, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
       RETURNING id, username, email`,
      [
        'admin', 
        'admin@exemplo.com', 
        hashedPassword, 
        'Administrador', 
        'Empresa', 
        '123456789', 
        'Usuário administrador', 
        null, 
        'https://n8n.exemplo.com/webhook/whatsapp', 
        'https://n8n.exemplo.com/webhook/prospectingwebhook', 
        'https://n8n.exemplo.com/webhook/aiwebhook', 
        'https://n8n.exemplo.com/webhook/contacts', 
        'https://n8n.exemplo.com/webhook/scheduling', 
        'https://n8n.exemplo.com/webhook/crm', 
        1000, 
        true
      ]
    );
    
    console.log("Novo usuário criado:", res.rows[0]);
    
    // Criar configurações padrão para o novo usuário
    await pool.query(
      `INSERT INTO settings (user_id, logo_url, primary_color, secondary_color, dark_mode)
       VALUES ($1, $2, $3, $4, $5)`,
      [res.rows[0].id, null, "#047857", "#4f46e5", false]
    );
    
    console.log("Configurações criadas para o novo usuário");
    
  } catch (err) {
    console.error("Erro ao criar usuário:", err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);