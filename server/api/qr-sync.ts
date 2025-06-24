/**
 * Sistema automático de sincronização QR Code
 * Monitora mensagens da Evolution API e atualiza tabela contacts
 */

import { pool } from '../db';

interface QrMessage {
  id: string;
  key: {
    remoteJid: string;
    fromMe: boolean;
  };
  pushName?: string;
  messageTimestamp: number;
  message: any;
}

class QrSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    
    console.log('🔄 Iniciando serviço de sincronização QR Code automática');
    this.isRunning = true;
    
    // Sincronizar a cada 30 segundos
    this.syncInterval = setInterval(() => {
      this.syncAllUsers().catch(error => {
        console.error('❌ Erro na sincronização automática QR Code:', error);
      });
    }, 30000);
    
    // Executar sincronização inicial
    this.syncAllUsers().catch(error => {
      console.error('❌ Erro na sincronização inicial QR Code:', error);
    });
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Serviço de sincronização QR Code parado');
  }

  async syncAllUsers() {
    try {
      // Buscar todos os usuários que têm servidores Evolution API configurados
      const usersQuery = `
        SELECT DISTINCT us.user_id, s.api_url, s.api_token
        FROM user_servers us
        JOIN servers s ON us.server_id = s.id
        WHERE s.api_url IS NOT NULL 
          AND s.api_token IS NOT NULL
          AND s.provider = 'evolution'
      `;
      
      const usersResult = await pool.query(usersQuery);
      
      for (const userRow of usersResult.rows) {
        await this.syncUserMessages(userRow.user_id, userRow.api_url, userRow.api_token);
      }
      
    } catch (error) {
      console.error('❌ Erro ao buscar usuários para sincronização:', error);
    }
  }

  private async syncUserMessages(userId: number, apiUrl: string, apiToken: string) {
    try {
      const username = await this.getUsernameById(userId);
      const instanceId = username;
      
      // Buscar mensagens recentes da Evolution API (últimas 24 horas)
      const response = await fetch(`${apiUrl}/chat/findMessages/${instanceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiToken
        },
        body: JSON.stringify({
          where: {
            messageTimestamp: {
              $gte: Date.now() - (24 * 60 * 60 * 1000) // Últimas 24 horas
            }
          },
          limit: 100,
          sort: { messageTimestamp: -1 }
        })
      });

      if (!response.ok) return;

      const data = await response.json();
      const messages = data.messages?.records || [];

      let syncedCount = 0;

      for (const message of messages) {
        const synced = await this.processMessage(userId, message);
        if (synced) syncedCount++;
      }

      if (syncedCount > 0) {
        console.log(`🔄 Sincronizadas ${syncedCount} mensagens QR Code para usuário ${userId}`);
      }

    } catch (error) {
      console.error(`❌ Erro ao sincronizar mensagens do usuário ${userId}:`, error);
    }
  }

  private async processMessage(userId: number, message: QrMessage): Promise<boolean> {
    try {
      const remoteJid = message.key.remoteJid;
      if (!remoteJid || remoteJid.includes('@g.us')) return false; // Ignorar grupos
      
      // Extrair número de telefone
      const phoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      if (!phoneNumber || phoneNumber === 'status') return false;
      
      const messageTime = new Date(message.messageTimestamp * 1000);
      const contactName = message.pushName || null;
      
      // Verificar se o contato já existe
      const existingQuery = `
        SELECT id, last_message_time 
        FROM contacts 
        WHERE user_id = $1 AND phone_number = $2 AND source = 'qr_code'
      `;
      
      const existingResult = await pool.query(existingQuery, [userId, phoneNumber]);
      
      if (existingResult.rows.length > 0) {
        // Atualizar apenas se a mensagem for mais recente
        const existingTime = new Date(existingResult.rows[0].last_message_time);
        if (messageTime > existingTime) {
          const updateQuery = `
            UPDATE contacts 
            SET last_message_time = $1,
                name = COALESCE($2, name),
                updated_at = NOW()
            WHERE id = $3
          `;
          
          await pool.query(updateQuery, [messageTime, contactName, existingResult.rows[0].id]);
          return true;
        }
      } else {
        // Inserir novo contato
        const insertQuery = `
          INSERT INTO contacts (
            user_id, phone_number, name, source, 
            last_message_time, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, 'qr_code', $4, true, NOW(), NOW())
        `;
        
        await pool.query(insertQuery, [userId, phoneNumber, contactName, messageTime]);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Erro ao processar mensagem QR Code:', error);
      return false;
    }
  }

  private async getUsernameById(userId: number): Promise<string> {
    try {
      const userQuery = 'SELECT username FROM users WHERE id = $1';
      const result = await pool.query(userQuery, [userId]);
      return result.rows[0]?.username || `user_${userId}`;
    } catch (error) {
      return `user_${userId}`;
    }
  }
}

// Instância singleton do serviço
export const qrSyncService = new QrSyncService();