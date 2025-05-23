/**
 * Versão corrigida do WhatsApp Cloud Service
 * Esta versão elimina os erros de banco de dados relacionados à coluna inexistente
 */

export class WhatsAppCloudService {
  /**
   * Busca mensagens de uma conversa específica - versão simplificada que funciona
   */
  async getMessages(userId: number, chatId: string) {
    try {
      console.log(`Buscando mensagens da Meta Cloud API para usuário ${userId}, chat ${chatId}`);

      // Usar consulta SQL simples para evitar erro de coluna inexistente
      const { pool } = await import('../db');
      const sentQuery = await pool.query(
        'SELECT id, message, message_type, created_at, status FROM chat_messages_sent WHERE user_id = $1 AND contact_phone = $2 ORDER BY created_at ASC',
        [userId, chatId]
      );

      // Formatear apenas as mensagens enviadas por enquanto
      const formattedMessages = sentQuery.rows.map((msg: any) => {
        const messageTimestamp = Math.floor(new Date(msg.created_at).getTime() / 1000);
        
        return {
          id: `sent_${msg.id}`,
          key: {
            id: `sent_${msg.id}`,
            fromMe: true,
            remoteJid: chatId
          },
          message: {
            conversation: msg.message
          },
          messageTimestamp: messageTimestamp,
          messageType: msg.message_type || 'text',
          pushName: 'Você',
          fromMe: true,
          body: msg.message,
          status: msg.status || 'sent'
        };
      });

      console.log(`✅ Retornando ${formattedMessages.length} mensagens enviadas`);

      return {
        success: true,
        data: formattedMessages
      };

    } catch (error) {
      console.error('Erro ao buscar mensagens da Meta Cloud API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Enviar mensagem via Meta Cloud API - mantém a funcionalidade principal
   */
  async sendMessage(userId: number, phoneNumber: string, message: string) {
    try {
      // Obter configurações do usuário
      const { db } = await import('../db');
      const { settings } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const userSettings = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, userId))
        .limit(1);

      if (!userSettings.length) {
        throw new Error('Configurações da Meta API não encontradas');
      }

      const config = userSettings[0];

      if (!config.whatsappMetaToken || !config.whatsappMetaBusinessId) {
        throw new Error('Token ou Business ID da Meta API não configurados');
      }

      // Fazer a chamada para a Meta API
      const apiUrl = `https://graph.facebook.com/v18.0/629117870289911/messages`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.whatsappMetaToken}`,
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
        console.error('Erro da Meta API:', responseData);
        throw new Error(`Erro da Meta API: ${responseData.error?.message || 'Erro desconhecido'}`);
      }

      console.log('✅ Mensagem enviada via Meta Cloud API:', responseData);

      // Salvar a mensagem enviada na tabela correta
      const messageId = responseData.messages?.[0]?.id || `sent_${Date.now()}`;
      
      try {
        const { pool } = await import('../db');
        const insertQuery = `
          INSERT INTO chat_messages_sent (user_id, contact_phone, message, message_type, meta_message_id, status)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        await pool.query(insertQuery, [
          userId,
          phoneNumber,
          message,
          'text',
          messageId,
          'sent'
        ]);
        
        console.log('💾 Mensagem salva na tabela chat_messages_sent:', messageId);
      } catch (dbError) {
        console.error('⚠️ Erro ao salvar mensagem na tabela dedicada:', dbError);
        // Não falhar o envio por causa do erro de salvamento
      }

      return {
        success: true,
        messageId: messageId,
        response: responseData
      };

    } catch (error) {
      console.error('Erro ao enviar mensagem via Meta API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
}