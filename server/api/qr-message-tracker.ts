/**
 * Sistema de rastreamento de mensagens enviadas via QR Code
 * Atualiza a tabela contacts quando mensagens são enviadas
 */

import { pool } from '../db';

export async function trackQrMessageSent(
  userId: number, 
  phoneNumber: string, 
  message: string
): Promise<void> {
  try {
    console.log(`📤 Rastreando mensagem QR enviada para ${phoneNumber} pelo usuário ${userId}`);
    
    // Verificar se o contato já existe
    const existingQuery = `
      SELECT id, last_message_time 
      FROM contacts 
      WHERE user_id = $1 AND phone_number = $2 AND source = 'qr_code'
    `;
    
    const existingResult = await pool.query(existingQuery, [userId, phoneNumber]);
    const currentTime = new Date();
    
    if (existingResult.rows.length > 0) {
      // Atualizar contato existente com nova mensagem
      const updateQuery = `
        UPDATE contacts 
        SET last_message_time = $1,
            last_message = $2,
            updated_at = NOW()
        WHERE id = $3
      `;
      
      await pool.query(updateQuery, [currentTime, message, existingResult.rows[0].id]);
      console.log(`✅ Contato QR atualizado: ${phoneNumber}`);
    } else {
      // Criar novo contato
      const insertQuery = `
        INSERT INTO contacts (
          user_id, phone_number, name, source, 
          last_message_time, last_message, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, 'qr_code', $4, $5, true, NOW(), NOW())
      `;
      
      await pool.query(insertQuery, [
        userId, 
        phoneNumber, 
        phoneNumber, // Usar número como nome temporário
        currentTime, 
        message
      ]);
      console.log(`✅ Novo contato QR criado: ${phoneNumber}`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao rastrear mensagem QR enviada:', error);
  }
}

export async function trackBulkQrMessages(
  userId: number, 
  phoneNumbers: string[], 
  message: string
): Promise<void> {
  try {
    console.log(`📤 Rastreando ${phoneNumbers.length} mensagens QR em lote para usuário ${userId}`);
    
    for (const phoneNumber of phoneNumbers) {
      await trackQrMessageSent(userId, phoneNumber, message);
    }
    
    console.log(`✅ Rastreamento em lote concluído: ${phoneNumbers.length} contatos processados`);
  } catch (error) {
    console.error('❌ Erro no rastreamento em lote QR:', error);
  }
}