import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { Pool } from "pg";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function debugUserDeletion() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔧 Criando usuário para teste de exclusão...");
    
    // Criar usuário de teste
    const username = "testuserdelete";
    const email = "delete@test.com";
    const password = await hashPassword("123456");
    
    const newUser = await pool.query(
      `INSERT INTO users (username, email, password, name, company, is_admin) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [username, email, password, "Usuário Delete", "Empresa Delete", false]
    );
    
    const userId = newUser.rows[0].id;
    console.log(`✅ Usuário criado com ID: ${userId}`);
    
    // Criar algumas configurações para o usuário
    await pool.query(
      `INSERT INTO settings (user_id, logo_url, primary_color) VALUES ($1, $2, $3)`,
      [userId, "https://example.com/logo.png", "#047857"]
    );
    console.log("✅ Configurações criadas para o usuário");
    
    // Tentar excluir através da API simulada
    console.log("🧪 Testando exclusão através da função storage...");
    
    // Verificar tabelas que referenciam o usuário
    const tables = [
      'ai_agent', 'ai_agent_steps', 'ai_agent_faqs', 'leads', 'lead_interactions', 
      'lead_recommendations', 'prospecting_searches', 'prospecting_results',
      'prospects', 'dispatches', 'metrics', 'settings', 'message_templates',
      'message_sendings', 'message_sending_history', 'whatsapp_contacts',
      'whatsapp_messages', 'user_servers'
    ];
    
    console.log("📊 Verificando referências antes da exclusão:");
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${table} WHERE user_id = $1`, [userId]);
        if (result.rows[0].count > 0) {
          console.log(`   ${table}: ${result.rows[0].count} registros`);
        }
      } catch (error) {
        // Tabela pode não ter coluna user_id
      }
    }
    
    // Tentar exclusão manual step by step
    console.log("🗑️ Iniciando exclusão manual...");
    
    // 1. Deletar tabelas sem dependências primeiro
    const deleteOrder = [
      'ai_agent_steps',
      'ai_agent_faqs', 
      'ai_agent',
      'lead_interactions',
      'lead_recommendations',
      'prospecting_results',
      'prospecting_searches',
      'leads',
      'prospects', 
      'dispatches',
      'metrics',
      'message_sending_history',
      'message_sendings',
      'message_templates',
      'whatsapp_messages',
      'whatsapp_contacts',
      'user_servers',
      'settings'
    ];
    
    for (const table of deleteOrder) {
      try {
        const result = await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
        if (result.rowCount && result.rowCount > 0) {
          console.log(`   ✅ ${table}: ${result.rowCount} registros deletados`);
        }
      } catch (error) {
        console.log(`   ⚠️ ${table}: ${error.message}`);
      }
    }
    
    // 2. Deletar o usuário
    const userDelete = await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    if (userDelete.rowCount && userDelete.rowCount > 0) {
      console.log(`✅ Usuário ${userId} excluído com sucesso!`);
    } else {
      console.log(`❌ Falha ao excluir usuário ${userId}`);
    }
    
    await pool.end();
    
  } catch (error) {
    console.error("❌ Erro:", error);
    await pool.end();
  }
}

debugUserDeletion();