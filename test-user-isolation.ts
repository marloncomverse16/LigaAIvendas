import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { Pool } from "pg";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createTestUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔧 Criando usuário de teste para verificar isolamento...");
    
    const username = "testuser";
    const email = "test@exemplo.com";
    const password = await hashPassword("123456");
    
    // Verificar se usuário já existe
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE username = $1 OR email = $2",
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      console.log("❌ Usuário de teste já existe");
      await pool.end();
      return;
    }
    
    // Criar novo usuário
    const result = await pool.query(
      `INSERT INTO users (username, email, password, name, company, is_admin) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [username, email, password, "Usuário Teste", "Empresa Teste", false]
    );
    
    const userId = result.rows[0].id;
    console.log(`✅ Usuário de teste criado com ID: ${userId}`);
    
    // Verificar se dados estão isolados
    const settingsCheck = await pool.query(
      "SELECT COUNT(*) as count FROM settings WHERE user_id = $1",
      [userId]
    );
    
    console.log(`📊 Configurações do novo usuário: ${settingsCheck.rows[0].count}`);
    
    // Verificar se não há vazamento de dados
    const allSettings = await pool.query("SELECT user_id, COUNT(*) as count FROM settings GROUP BY user_id");
    console.log("📊 Configurações por usuário:");
    allSettings.rows.forEach(row => {
      console.log(`   Usuário ${row.user_id}: ${row.count} configurações`);
    });
    
    await pool.end();
    console.log("✅ Teste de isolamento concluído");
    
  } catch (error) {
    console.error("❌ Erro no teste:", error);
    await pool.end();
  }
}

createTestUser();