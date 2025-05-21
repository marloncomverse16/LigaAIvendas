import { eq, and, lt, desc, gt, sql, max } from "drizzle-orm";
import { db } from "../db";
import { whatsappMessages } from "@shared/schema";

// Função para salvar mensagens no banco de dados
export async function saveMessages(
  messages: any[],
  remoteJid: string,
  userId: number,
  instanceId: string
) {
  try {
    // Calcular data de expiração (90 dias a partir de agora)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Busca mensagens existentes para não duplicar
    const existingMsgIds = await db
      .select({ messageId: whatsappMessages.messageId })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.remoteJid, remoteJid),
          eq(whatsappMessages.userId, userId)
        )
      );

    const existingIds = new Set(existingMsgIds.map(msg => msg.messageId));
    
    // Filtrar apenas novas mensagens
    const newMessages = messages.filter(msg => {
      // Considera o id do objeto mensagem ou id na chave
      const msgId = msg.id || msg.key?.id;
      return msgId && !existingIds.has(msgId);
    });
    
    if (newMessages.length === 0) {
      return { inserted: 0, total: messages.length };
    }

    // Preparar dados para inserção
    const messagesToInsert = newMessages.map(msg => {
      const messageContent = 
        msg.message?.conversation || 
        (msg.message?.extendedTextMessage?.text) ||
        JSON.stringify(msg.message || {});
      
      return {
        messageId: msg.id || msg.key?.id,
        chatId: remoteJid,
        fromMe: msg.key?.fromMe || false,
        remoteJid: remoteJid,
        pushName: msg.pushName || "",
        messageType: msg.messageType || "conversation",
        content: messageContent,
        messageTimestamp: Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
        instanceId: instanceId,
        userId: userId,
        expiresAt: expiresAt
      };
    });

    // Inserir mensagens no banco de dados
    await db.insert(whatsappMessages).values(messagesToInsert);

    return { inserted: messagesToInsert.length, total: messages.length };
  } catch (error) {
    console.error("Erro ao salvar mensagens:", error);
    throw error;
  }
}

// Função para recuperar mensagens do banco de dados
export async function getMessages(
  remoteJid: string,
  userId: number,
  limit = 50,
  beforeTimestamp?: number
) {
  try {
    // Construir a consulta
    const query = db
      .select()
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.remoteJid, remoteJid),
          eq(whatsappMessages.userId, userId)
        )
      )
      .orderBy(desc(whatsappMessages.messageTimestamp))
      .limit(limit);

    let messages = await query;

    // Converter para o formato esperado pela interface
    return messages.map(msg => ({
      id: msg.messageId,
      key: {
        id: msg.messageId,
        fromMe: msg.fromMe,
        remoteJid: msg.remoteJid
      },
      pushName: msg.pushName,
      messageType: msg.messageType,
      message: {
        conversation: msg.content
      },
      messageTimestamp: msg.messageTimestamp,
      instanceId: msg.instanceId
    }));
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    throw error;
  }
}

// Função para excluir mensagens expiradas (mais de 90 dias)
export async function cleanupExpiredMessages() {
  try {
    const now = new Date();
    const deleted = await db
      .delete(whatsappMessages)
      .where(lt(whatsappMessages.expiresAt, now))
      .returning({ id: whatsappMessages.id });

    return { deleted: deleted.length };
  } catch (error) {
    console.error("Erro ao limpar mensagens expiradas:", error);
    throw error;
  }
}

// Função para verificar se precisamos buscar novas mensagens da API
export async function getLastMessageTimestamp(
  remoteJid: string,
  userId: number
) {
  try {
    const result = await db
      .select({ maxTimestamp: max(whatsappMessages.messageTimestamp) })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.remoteJid, remoteJid),
          eq(whatsappMessages.userId, userId)
        )
      );

    return result[0]?.maxTimestamp || 0;
  } catch (error) {
    console.error("Erro ao buscar último timestamp:", error);
    return 0;
  }
}