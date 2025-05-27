/**
 * Novo serviço Meta Cloud API - Limpo e funcional
 * Usando apenas comunicações que sabemos que funcionam
 */

interface MetaApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class MetaCloudChatService {
  /**
   * Buscar conversas/contatos via Meta Cloud API
   */
  async getChats(userId: number): Promise<MetaApiResponse> {
    try {
      // Buscar configurações do usuário no banco
      const userSettings = await this.getUserMetaSettings(userId);
      if (!userSettings.phoneNumberId || !userSettings.token) {
        return {
          success: false,
          error: 'Configurações Meta API não encontradas para este usuário'
        };
      }

      // Para a Meta API, não existe um endpoint direto para listar conversas
      // Vamos retornar contatos salvos do banco de dados
      const savedContacts = await this.getSavedContacts(userId);
      
      return {
        success: true,
        data: savedContacts
      };
    } catch (error) {
      console.error('Erro ao buscar chats Meta Cloud API:', error);
      return {
        success: false,
        error: 'Erro ao buscar conversas'
      };
    }
  }

  /**
   * Buscar contatos salvos no banco de dados
   */
  private async getSavedContacts(userId: number) {
    try {
      const { pool } = await import('../db');
      // Buscar mensagens recentes agrupadas por contato usando SQL nativo
      const result = await pool.query(`
        SELECT DISTINCT 
          contact_phone as id,
          contact_phone as name,
          (SELECT message_content FROM meta_chat_messages m2 
           WHERE m2.contact_phone = m1.contact_phone 
           ORDER BY created_at DESC LIMIT 1) as lastMessage,
          (SELECT EXTRACT(EPOCH FROM created_at) * 1000 
           FROM meta_chat_messages m3 
           WHERE m3.contact_phone = m1.contact_phone 
           ORDER BY created_at DESC LIMIT 1) as timestamp
        FROM meta_chat_messages m1
        WHERE user_id = $1
        ORDER BY timestamp DESC
        LIMIT 50
      `, [userId]);

      console.log(`📋 Contatos encontrados no banco: ${result.rows.length}`);
      console.log('📋 Dados dos contatos:', result.rows);
      
      return result.rows.map((contact: any) => ({
        id: contact.id,
        name: contact.id,
        lastMessage: contact.lastmessage || 'Nenhuma mensagem',
        timestamp: parseInt(contact.timestamp) || Date.now(),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Erro ao buscar contatos salvos:', error);
      return [];
    }
  }

  /**
   * Buscar configurações Meta do usuário
   */
  private async getUserMetaSettings(userId: number) {
    try {
      const { db } = await import('../db');
      const { userServers } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [userServer] = await db
        .select()
        .from(userServers)
        .where(eq(userServers.userId, userId))
        .limit(1);

      return {
        phoneNumberId: userServer?.metaPhoneNumberId || null,
        token: process.env.META_API_TOKEN || null,
        businessId: process.env.META_BUSINESS_ID || null
      };
    } catch (error) {
      console.error('Erro ao buscar configurações Meta:', error);
      return {
        phoneNumberId: null,
        token: null,
        businessId: null
      };
    }
  }

  /**
   * Enviar mensagem via Meta Cloud API
   */
  async sendMessage(userId: number, phoneNumber: string, message: string): Promise<MetaApiResponse> {
    try {
      console.log(`🚀 Enviando mensagem Meta API: ${phoneNumber} -> "${message.substring(0, 50)}..."`);

      // Buscar configurações do usuário
      const { pool } = await import('../db');
      const settingsQuery = await pool.query(
        'SELECT whatsapp_meta_token, whatsapp_meta_business_id FROM settings WHERE user_id = $1',
        [userId]
      );

      if (!settingsQuery.rows.length) {
        throw new Error('Configurações da Meta API não encontradas');
      }

      const { whatsapp_meta_token, whatsapp_meta_business_id } = settingsQuery.rows[0];
      
      if (!whatsapp_meta_token || !whatsapp_meta_business_id) {
        throw new Error('Token ou Business ID da Meta API não configurados');
      }

      // Enviar via Meta API (usando Phone Number ID fixo que sabemos que funciona)
      const phoneNumberId = '629117870289911';
      const apiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsapp_meta_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: {
            body: message
          }
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('❌ Erro da Meta API:', responseData);
        throw new Error(`Meta API Error: ${responseData.error?.message || 'Erro desconhecido'}`);
      }

      console.log('✅ Mensagem enviada com sucesso:', responseData);

      // Salvar mensagem no banco
      const messageId = responseData.messages?.[0]?.id || `sent_${Date.now()}`;
      
      await pool.query(
        'INSERT INTO meta_chat_messages (user_id, contact_phone, message_content, message_type, from_me, meta_message_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [userId, phoneNumber, message, 'text', true, messageId, 'sent']
      );

      console.log('💾 Mensagem salva no banco:', messageId);

      return {
        success: true,
        data: {
          messageId,
          response: responseData
        }
      };

    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Buscar mensagens de uma conversa
   */
  async getMessages(userId: number, phoneNumber: string): Promise<MetaApiResponse> {
    try {
      console.log(`📥 Buscando mensagens para: ${phoneNumber}`);

      const { pool } = await import('../db');
      const messagesQuery = await pool.query(
        'SELECT * FROM meta_chat_messages WHERE user_id = $1 AND contact_phone = $2 ORDER BY created_at ASC',
        [userId, phoneNumber]
      );

      const messages = messagesQuery.rows.map((row: any) => ({
        id: row.id,
        key: {
          id: row.meta_message_id || `msg_${row.id}`,
          fromMe: row.from_me,
          remoteJid: phoneNumber
        },
        message: {
          conversation: row.message_content
        },
        messageTimestamp: Math.floor(new Date(row.created_at).getTime() / 1000),
        messageType: row.message_type,
        pushName: row.from_me ? 'Você' : 'Contato',
        fromMe: row.from_me,
        body: row.message_content,
        status: row.status
      }));

      console.log(`✅ Encontradas ${messages.length} mensagens`);

      return {
        success: true,
        data: messages
      };

    } catch (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Salvar mensagem recebida via webhook
   */
  async saveReceivedMessage(userId: number, phoneNumber: string, messageContent: string, metaMessageId: string): Promise<MetaApiResponse> {
    try {
      const { pool } = await import('../db');
      
      await pool.query(
        'INSERT INTO meta_chat_messages (user_id, contact_phone, message_content, message_type, from_me, meta_message_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [userId, phoneNumber, messageContent, 'text', false, metaMessageId, 'delivered']
      );

      console.log('💾 Mensagem recebida salva:', metaMessageId);

      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao salvar mensagem recebida:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
}