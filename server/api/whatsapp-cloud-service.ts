/**
 * Serviço para integração com WhatsApp Cloud API (Meta)
 * Busca conversas e mensagens reais da Meta API
 */

import { db } from '../db';
import { whatsappCloudChats, whatsappCloudMessages } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { userSettingsService } from './user-settings-service';

export class WhatsAppCloudService {
  /**
   * Busca conversas do usuário da Meta API
   */
  async getChats(userId: number) {
    try {
      // Obter configurações do usuário
      const settingsResult = await userSettingsService.getUserSettings(userId);
      
      if (!settingsResult.success || !settingsResult.data) {
        throw new Error('Configurações não encontradas');
      }

      const settings = settingsResult.data;

      if (!settings.whatsappMetaToken || !settings.whatsappMetaBusinessId) {
        throw new Error('Configurações da Meta API não encontradas');
      }

      // Primeiro, buscar conversas existentes no banco de dados
      const existingChats = await db
        .select()
        .from(whatsappCloudChats)
        .where(eq(whatsappCloudChats.userId, userId))
        .orderBy(desc(whatsappCloudChats.lastMessageTime));

      console.log(`Encontradas ${existingChats.length} conversas existentes do Cloud API para usuário ${userId}`);

      // Para o WhatsApp Cloud API, as conversas são criadas quando mensagens são enviadas/recebidas
      // A Meta API não fornece uma lista de "conversas" como a Evolution API
      // Então retornamos as conversas que já temos no banco de dados
      
      return {
        success: true,
        data: existingChats.map(chat => ({
          id: chat.id,
          remoteJid: chat.remoteJid,
          pushName: chat.pushName || chat.phoneNumber || 'Contato',
          profilePicUrl: chat.profilePicUrl || '',
          updatedAt: chat.lastMessageTime || chat.updatedAt,
          unreadCount: chat.unreadCount || 0,
          source: 'meta' // Identificar que vem da Meta API
        }))
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
  async getMessages(userId: number, chatId: string, limit: number = 50) {
    try {
      const messages = await db
        .select()
        .from(whatsappCloudMessages)
        .where(
          and(
            eq(whatsappCloudMessages.userId, userId),
            eq(whatsappCloudMessages.chatId, chatId)
          )
        )
        .orderBy(desc(whatsappCloudMessages.timestamp))
        .limit(limit);

      return {
        success: true,
        data: messages.reverse() // Retornar em ordem cronológica
      };

    } catch (error) {
      console.error('Erro ao buscar mensagens da Meta API:', error);
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