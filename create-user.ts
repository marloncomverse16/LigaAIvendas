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
  // Gerar hash para a senha "123456"
  const hashedPassword = await hashPassword("123456");
  console.log("Hash:", hashedPassword);

  // Conectar ao banco de dados
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Atualizar usuário existente
    const res = await pool.query(
      `UPDATE users SET password = $1 WHERE id = 1 RETURNING id, username, email`,
      [hashedPassword]
    );
    
    console.log("Usuário atualizado:", res.rows[0]);
  } catch (err) {
    console.error("Erro ao atualizar usuário:", err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);