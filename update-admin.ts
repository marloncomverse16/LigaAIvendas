import { db } from "./server/db";
import { users } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  try {
    // Atualiza o usuário admin para ter a flag isAdmin = true
    await db.update(users)
      .set({ isAdmin: true })
      .where(eq(users.username, 'admin'));
    
    console.log("Usuário admin atualizado com sucesso!");
    
    // Verifica se a atualização funcionou
    const adminUser = await db.select()
      .from(users)
      .where(eq(users.username, 'admin'));
    
    console.log("Usuário admin:", adminUser);
  } catch (error) {
    console.error("Erro ao atualizar usuário admin:", error);
  }
}

main().catch(console.error);
