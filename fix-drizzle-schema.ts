/**
 * Script para sincronizar o esquema Drizzle ORM com o banco de dados
 * Usado para resolver problemas de colunas meta_* não encontradas
 */

import { resolve } from 'path';
import { writeFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/pg-core';
import { migrate } from 'drizzle-orm/pg-core/migrations';

async function main() {
  console.log('Sincronizando esquema do Drizzle ORM com o banco de dados...');
  
  // Ler o esquema atual
  const schemaPath = resolve('./shared/schema.ts');
  let schemaContent = await import('fs').then(fs => fs.readFileSync(schemaPath, 'utf-8'));
  
  // Verificar se há definições corretas das tabelas com meta_* colunas
  const checkUserServers = schemaContent.includes('metaPhoneNumberId: text("meta_phone_number_id")');
  const checkMetaConnected = schemaContent.includes('metaConnected: boolean("meta_connected")');
  const checkMetaConnectedAt = schemaContent.includes('metaConnectedAt: timestamp("meta_connected_at")');
  
  if (!checkUserServers || !checkMetaConnected || !checkMetaConnectedAt) {
    console.log('⚠️ Algumas colunas meta_* não estão definidas corretamente no schema! Ajustando...');
    
    // Para encontrar a definição da tabela user_servers
    const userServersRegex = /export const userServers = pgTable\("user_servers", \{[\s\S]*?\}\);/;
    const userServersMatch = schemaContent.match(userServersRegex);
    
    if (userServersMatch) {
      const currentUserServers = userServersMatch[0];
      
      // Construir a definição correta da tabela user_servers
      const correctedUserServers = `export const userServers = pgTable("user_servers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  serverId: integer("server_id").notNull().references(() => servers.id),
  isDefault: boolean("is_default").default(false),
  
  // Campos para WhatsApp Meta API (Cloud API)
  metaPhoneNumberId: text("meta_phone_number_id"), // ID do número de telefone no WhatsApp Business
  metaConnected: boolean("meta_connected").default(false), // Status da conexão
  metaConnectedAt: timestamp("meta_connected_at"), // Quando a conexão foi estabelecida
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});`;
      
      // Substituir a definição atual pela corrigida
      schemaContent = schemaContent.replace(currentUserServers, correctedUserServers);
      
      // Salvar o arquivo atualizado
      writeFileSync(schemaPath, schemaContent);
      console.log('✅ Schema atualizado com definições corretas de colunas meta_*');
    } else {
      console.log('❌ Não foi possível encontrar a definição da tabela user_servers no schema');
    }
  } else {
    console.log('✅ As colunas meta_* estão definidas corretamente no schema');
  }
  
  // Verificar definição da tabela servers para as colunas meta
  const checkServersMetaToken = schemaContent.includes('whatsappMetaToken: text("whatsapp_meta_token")');
  const checkServersMetaBusinessId = schemaContent.includes('whatsappMetaBusinessId: text("whatsapp_meta_business_id")');
  const checkServersMetaApiVersion = schemaContent.includes('whatsappMetaApiVersion: text("whatsapp_meta_api_version")');
  
  if (!checkServersMetaToken || !checkServersMetaBusinessId || !checkServersMetaApiVersion) {
    console.log('⚠️ Algumas colunas Meta para servers não estão definidas corretamente no schema! Ajustando...');
    
    // Para encontrar a definição da tabela servers
    const serversRegex = /export const servers = pgTable\("servers", \{[\s\S]*?\}\);/;
    const serversMatch = schemaContent.match(serversRegex);
    
    if (serversMatch) {
      let currentServers = serversMatch[0];
      
      // Verificar se já temos as colunas específicas
      if (!currentServers.includes('whatsappMetaToken')) {
        // Encontrar a posição para adicionar as novas colunas (antes do último fechamento)
        const lastBraceIndex = currentServers.lastIndexOf('}');
        const beforeBrace = currentServers.substring(0, lastBraceIndex);
        const afterBrace = currentServers.substring(lastBraceIndex);
        
        // Adicionar as colunas Meta API
        const metaColumns = `
  // Campos para WhatsApp Meta API (Cloud API)
  whatsappMetaToken: text("whatsapp_meta_token"),
  whatsappMetaBusinessId: text("whatsapp_meta_business_id"),
  whatsappMetaApiVersion: text("whatsapp_meta_api_version").default("v18.0"),
  `;
        
        const updatedServers = beforeBrace + metaColumns + afterBrace;
        
        // Substituir a definição atual pela atualizada
        schemaContent = schemaContent.replace(currentServers, updatedServers);
        
        // Salvar o arquivo atualizado
        writeFileSync(schemaPath, schemaContent);
        console.log('✅ Schema atualizado com definições de colunas Meta API para servers');
      } else {
        console.log('✅ Colunas Meta API para servers já estão definidas corretamente');
      }
    } else {
      console.log('❌ Não foi possível encontrar a definição da tabela servers no schema');
    }
  } else {
    console.log('✅ As colunas Meta API para servers estão definidas corretamente no schema');
  }
  
  console.log('Sincronização do schema concluída!');
}

main().catch(error => {
  console.error('Erro na sincronização do schema:', error);
  process.exit(1);
});