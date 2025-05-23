/**
 * Serviço para integração com WhatsApp Cloud API (Meta)
 * Busca conversas e mensagens reais da Meta API
 */

import { db } from '../db';
import { whatsappCloudChats, whatsappCloudMessages } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
// Importar configurações do banco de dados
import { settings } from '@shared/schema';

export class WhatsAppCloudService {
  /**
   * Busca conversas do usuário da Meta API
   */
  async getChats(userId: number) {
    try {
      // Obter configurações globais das Integrações
      const userSettings = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, userId))
        .limit(1);

      if (!userSettings.length) {
        throw new Error('Configurações não encontradas');
      }

      const config = userSettings[0];

      if (!config.whatsappMetaToken || !config.whatsappMetaBusinessId) {
        throw new Error('Configurações da Meta API não encontradas');
      }

      // Primeiro, buscar conversas existentes no banco de dados
      const existingChats = await db
        .select()
        .from(whatsappCloudChats)
        .where(eq(whatsappCloudChats.userId, userId))
        .orderBy(desc(whatsappCloudChats.lastMessageTime));

      console.log(`Encontradas ${existingChats.length} conversas existentes do Cloud API para usuário ${userId}`);
      console.log('Dados dos chats encontrados:', existingChats);

      // Transformar os dados para o formato esperado pelo frontend
      const chatsFormatted = existingChats.map(chat => ({
        id: chat.id,
        remoteJid: chat.remoteJid,
        pushName: chat.pushName || chat.phoneNumber || 'Contato',
        profilePicUrl: chat.profilePicUrl || '',
        updatedAt: chat.lastMessageTime || chat.updatedAt,
        unreadCount: chat.unreadCount || 0,
        source: 'meta', // Identificar que vem da Meta API
        lastMessage: 'Conversa via WhatsApp Cloud API',
        lastMessageTime: chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Agora'
      }));

      console.log('Chats formatados para envio:', chatsFormatted);
      
      return {
        success: true,
        data: chatsFormatted
      };

    } catch (error) {
      console.error('Erro ao buscar chats da Meta API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Busca mensagens de uma conversa específica
   */
  async getMessages(userId: number, chatId: string) {
    try {
      console.log(`Buscando mensagens da Meta Cloud API para usuário ${userId}, chat ${chatId}`);

      // Primeiro, buscar mensagens recebidas via webhook
      const receivedMessages = await db.execute(`
        SELECT id, user_id as "userId", remote_jid as "remoteJid", 
               COALESCE(content, message_content) as "messageContent", 
               'Usuario' as "pushName", message_type as "messageType", from_me as "fromMe", 
               timestamp, timestamp as "messageTimestamp", 'meta-cloud-api' as "instanceId", 
               message_type as "mediaType", media_url as "mediaUrl", true as "isRead", 
               created_at as "createdAt", 'webhook' as source
        FROM whatsapp_cloud_messages 
        WHERE user_id = ${userId} AND remote_jid = '${chatId}'
        ORDER BY timestamp ASC
      `);

      // Depois, buscar mensagens enviadas da tabela correta
      const sentMessages = await db.execute(`
        SELECT id, user_id as "userId", chat_id as "remoteJid", message as "messageContent", 
               'Você' as "pushName", 'text' as "messageType", true as "fromMe", 
               timestamp, timestamp as "messageTimestamp", 'meta-cloud-api' as "instanceId", 
               null as "mediaType", null as "mediaUrl", 
               true as "isRead", 
               created_at as "createdAt", 'sent' as source
        FROM chat_messages_sent 
        WHERE user_id = ${userId} AND chat_id = '${chatId}'
        ORDER BY timestamp ASC
      `);

      // Combinar os resultados
      const receivedRows = Array.isArray(receivedMessages) ? receivedMessages : receivedMessages.rows || [];
      const sentRows = Array.isArray(sentMessages) ? sentMessages : sentMessages.rows || [];
      const allMessages = [...receivedRows, ...sentRows].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      console.log(`Encontradas ${allMessages.length} mensagens total para o usuário ${userId} e chat ${chatId}`);

      // Transformar para o formato esperado pelo frontend
      const formattedMessages = allMessages.map(msg => {
        // Extrair conteúdo de forma segura dependendo da fonte
        let messageContent = '';
        if (msg.source === 'sent') {
          // Para mensagens enviadas (tabela whatsapp_messages)
          messageContent = (msg as any).content || '';
        } else {
          // Para mensagens recebidas (tabela whatsappCloudMessages)
          messageContent = (msg as any).messageContent || '';
        }
        
        const messageTimestamp = msg.timestamp ? Math.floor(new Date(msg.timestamp).getTime() / 1000) : Date.now();
        const messageStatus = (msg as any).status || 'delivered';
        const messageFromMe = msg.fromMe || false;
        const messageId = (msg as any).metaMessageId || (msg as any).message_id || msg.id;
        
        return {
          id: msg.id,
          key: {
            id: messageId,
            fromMe: messageFromMe,
            remoteJid: msg.remoteJid
          },
          message: {
            conversation: messageContent
          },
          messageTimestamp: messageTimestamp,
          messageType: msg.messageType || 'text',
          pushName: 'Meta Cloud API',
          fromMe: messageFromMe,
          body: messageContent,
          content: messageContent,
          timestamp: messageTimestamp,
          status: messageStatus
        };
      });

      console.log('Mensagens formatadas:', formattedMessages);

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
   * Busca contatos recentes do usuário da Meta API
   */
  async getRecentContacts(userId: number) {
    try {
      const recentChats = await this.getChats(userId);
      
      if (!recentChats.success) {
        return recentChats;
      }

      return {
        success: true,
        data: recentChats.data || []
      };

    } catch (error) {
      console.error('Erro ao buscar contatos recentes da Meta API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Criar uma nova conversa quando uma mensagem é enviada para um número novo
   */
  async createChatIfNotExists(userId: number, phoneNumber: string, name?: string) {
    try {
      // Normalizar o número de telefone para o formato do WhatsApp
      const normalizedPhone = phoneNumber.replace(/\D/g, ''); // Remove caracteres não numéricos
      const remoteJid = `${normalizedPhone}@c.us`;
      const chatId = `chat_${normalizedPhone}_${userId}`;

      // Verificar se a conversa já existe
      const existingChat = await db
        .select()
        .from(whatsappCloudChats)
        .where(
          and(
            eq(whatsappCloudChats.userId, userId),
            eq(whatsappCloudChats.remoteJid, remoteJid)
          )
        )
        .limit(1);

      if (existingChat.length > 0) {
        return {
          success: true,
          data: existingChat[0]
        };
      }

      // Criar nova conversa
      const newChat = await db
        .insert(whatsappCloudChats)
        .values({
          id: chatId,
          userId,
          remoteJid,
          phoneNumber: normalizedPhone,
          pushName: name || normalizedPhone,
          lastMessageTime: new Date(),
          unreadCount: 0
        })
        .returning();

      console.log(`Nova conversa Cloud API criada: ${chatId} para ${phoneNumber}`);

      return {
        success: true,
        data: newChat[0]
      };

    } catch (error) {
      console.error('Erro ao criar conversa da Meta API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Salvar uma mensagem enviada via Meta API
   */
  async saveMessage(userId: number, chatId: string, messageData: {
    content: string;
    remoteJid: string;
    fromMe: boolean;
    messageType?: string;
    metaMessageId?: string;
  }) {
    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const message = await db
        .insert(whatsappCloudMessages)
        .values({
          id: messageId,
          chatId,
          userId,
          remoteJid: messageData.remoteJid,
          messageContent: messageData.content,
          messageType: messageData.messageType || 'text',
          fromMe: messageData.fromMe,
          timestamp: new Date(),
          status: 'sent',
          metaMessageId: messageData.metaMessageId
        })
        .returning();

      // Atualizar última mensagem da conversa
      await db
        .update(whatsappCloudChats)
        .set({
          lastMessageTime: new Date(),
          updatedAt: new Date()
        })
        .where(eq(whatsappCloudChats.id, chatId));

      console.log(`Mensagem Cloud API salva: ${messageId}`);

      return {
        success: true,
        data: message[0]
      };

    } catch (error) {
      console.error('Erro ao salvar mensagem da Meta API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Enviar mensagem via Meta Cloud API
   */
  async sendMessage(userId: number, phoneNumber: string, message: string) {
    try {
      // Obter configurações do usuário
      const userSettings = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, userId))
        .limit(1);

      if (!userSettings.length) {
        throw new Error('Configurações não encontradas');
      }

      const config = userSettings[0];

      if (!config.whatsappMetaToken || !config.whatsappMetaBusinessId || !config.whatsappMetaPhoneNumberId) {
        throw new Error('Configurações da Meta API não encontradas ou incompletas');
      }

      // Fazer a chamada para a Meta API
      const apiUrl = `https://graph.facebook.com/v18.0/${config.whatsappMetaPhoneNumberId}/messages`;
      
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

      // 🚀 SALVAR A MENSAGEM ENVIADA NA NOVA TABELA DEDICADA PARA O CHAT
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

  /**
   * Buscar contatos/conversas recentes para exibir na lista
   */
  async getRecentContacts(userId: number) {
    try {
      const recentChats = await this.getChats(userId);
      
      if (!recentChats.success) {
        return recentChats;
      }

      // Formatar para o padrão esperado pelo frontend
      const contacts = recentChats.data.map(chat => ({
        id: chat.id,
        name: chat.pushName,
        phone: chat.remoteJid,
        lastMessage: 'Conversa via WhatsApp Cloud API',
        timestamp: chat.updatedAt,
        profilePic: chat.profilePicUrl,
        unread: chat.unreadCount || 0,
        source: 'meta'
      }));

      return {
        success: true,
        data: contacts
      };

    } catch (error) {
      console.error('Erro ao buscar contatos recentes da Meta API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
}

export const whatsappCloudService = new WhatsAppCloudService();