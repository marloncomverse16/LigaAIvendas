import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { Pool } from "pg";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function testUserDeletionAPI() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔧 Criando usuário para teste de exclusão via API...");
    
    // Criar usuário de teste
    const username = "testdelete2";
    const email = "testdelete2@test.com";
    const password = await hashPassword("123456");
    
    const newUser = await pool.query(
      `INSERT INTO users (username, email, password, name, company, is_admin) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [username, email, password, "Test Delete 2", "Company Test", false]
    );
    
    const userId = newUser.rows[0].id;
    console.log(`✅ Usuário criado com ID: ${userId}`);
    
    // Adicionar algumas configurações e dados
    await pool.query(
      `INSERT INTO settings (user_id, logo_url, primary_color, meta_vendas_empresa) VALUES ($1, $2, $3, $4)`,
      [userId, "https://test.com/logo.png", "#047857", "5000"]
    );
    
    await pool.query(
      `INSERT INTO leads (user_id, name, email, phone, company) VALUES ($1, $2, $3, $4, $5)`,
      [userId, "Lead Test", "lead@test.com", "11999887766", "Lead Company"]
    );
    
    console.log("✅ Dados de teste criados para o usuário");
    
    // Verificar dados antes da exclusão
    const beforeCheck = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM settings WHERE user_id = $1) as settings_count,
        (SELECT COUNT(*) FROM leads WHERE user_id = $1) as leads_count,
        (SELECT COUNT(*) FROM users WHERE id = $1) as user_count
    `, [userId]);
    
    console.log("📊 Dados antes da exclusão:", beforeCheck.rows[0]);
    
    // Simular chamada da API de exclusão
    console.log("🗑️ Testando exclusão através da função storage...");
    
    // Importar e usar a função de storage diretamente
    const { storage } = await import('./server/storage');
    const deleteResult = await storage.deleteUser(userId);
    
    if (deleteResult) {
      console.log("✅ Função deleteUser retornou sucesso");
      
      // Verificar se dados foram realmente removidos
      const afterCheck = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM settings WHERE user_id = $1) as settings_count,
          (SELECT COUNT(*) FROM leads WHERE user_id = $1) as leads_count,
          (SELECT COUNT(*) FROM users WHERE id = $1) as user_count
      `, [userId]);
      
      console.log("📊 Dados após exclusão:", afterCheck.rows[0]);
      
      const { settings_count, leads_count, user_count } = afterCheck.rows[0];
      
      if (settings_count === "0" && leads_count === "0" && user_count === "0") {
        console.log("✅ TESTE PASSOU: Usuário e todos os dados foram excluídos!");
      } else {
        console.log("❌ TESTE FALHOU: Alguns dados não foram excluídos");
      }
    } else {
      console.log("❌ Função deleteUser retornou falha");
    }
    
    await pool.end();
    
  } catch (error) {
    console.error("❌ Erro no teste:", error);
    await pool.end();
  }
}

testUserDeletionAPI();