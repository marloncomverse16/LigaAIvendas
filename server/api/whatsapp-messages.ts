/**
 * API para gerenciar mensagens do WhatsApp
 * Fornece endpoints para listar, buscar e enviar mensagens do WhatsApp
 */

import { Request, Response } from "express";
import { z } from "zod";
import { EvolutionApiClient } from "../evolution-api";
import { db } from "../db";
import { eq, and, desc, asc } from "drizzle-orm";
import { userServers, servers, users, messageSendingHistory } from "../../shared/schema";

// Esquema de validação para mensagens
const MessageSchema = z.object({
  id: z.string(),
  contactId: z.string(),
  content: z.string(),
  timestamp: z.date(),
  isIncoming: z.boolean(),
  status: z.enum(['sent', 'delivered', 'read', 'pending']),
  type: z.enum(['text', 'image', 'audio', 'document'])
});

// Esquema para envio de mensagem
const SendMessageSchema = z.object({
  contactId: z.string(),
  content: z.string().min(1, "Conteúdo da mensagem não pode estar vazio"),
  type: z.enum(['text', 'image', 'audio', 'document']).default('text')
});

export type Message = z.infer<typeof MessageSchema>;
export type SendMessageRequest = z.infer<typeof SendMessageSchema>;

/**
 * Obtém o servidor associado ao usuário
 */
async function fetchUserServer(userId: number) {
  try {
    console.log(`Buscando servidor para o usuário ${userId}...`);
    
    // Usar Drizzle em vez de SQL bruto
    const userServersData = await db.query.userServers.findMany({
      where: eq(userServers.userId, userId),
      with: {
        server: true
      }
    });
    
    console.log(`Encontradas ${userServersData.length} relações para o usuário ${userId}`);
    
    // Filtrar apenas servidores ativos
    const activeServerRelation = userServersData.find(relation => relation.server.active);
    
    if (!activeServerRelation) {
      console.log(`Nenhum servidor ativo encontrado para o usuário ${userId}`);
      return null;
    }
    
    console.log(`Usando servidor ${activeServerRelation.server.name} para o usuário ${userId}`);
    
    return activeServerRelation.server;
  } catch (error) {
    console.error("Erro ao buscar servidor do usuário:", error);
    return null;
  }
}

/**
 * Normaliza um número de telefone para o formato esperado pelo WhatsApp
 * Exemplo: +55 (43) 99114-2751 => 5543991142751
 */
function normalizePhoneNumber(phone: string): string {
  // Remover todos os caracteres não numéricos
  let normalized = phone.replace(/\D/g, '');
  
  // Se o número já começar com o código do país (ex: 55), usar como está
  if (normalized.startsWith('55') && normalized.length >= 12) {
    return normalized;
  }
  
  // Se não tiver código do país, adicionar 55 (Brasil)
  if (!normalized.startsWith('55') && normalized.length >= 10) {
    normalized = '55' + normalized;
  }
  
  return normalized;
}

/**
 * Endpoint para listar mensagens de um contato específico
 */
export async function listWhatsAppMessages(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    const userId = req.user?.id;
    const contactId = req.params.contactId;
    
    if (!userId) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }
    
    if (!contactId) {
      return res.status(400).json({ message: "ID do contato não fornecido" });
    }
    
    // Obter servidor associado ao usuário
    const server = await fetchUserServer(userId);
    
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        message: "Servidor do WhatsApp não configurado corretamente"
      });
    }
    
    // Criar cliente da Evolution API
    const instanceId = req.user.username;
    const evolutionClient = new EvolutionApiClient(
      server.apiUrl,
      server.apiToken,
      instanceId
    );
    
    // Buscar mensagens do contato
    try {
      console.log(`Buscando mensagens para o contato ${contactId}...`);
      
      // Normalizar número do contato (remover @c.us se presente)
      const normalizedContactId = contactId.includes('@') 
        ? contactId 
        : normalizePhoneNumber(contactId);
      
      // O formato correto do número depende da implementação do Evolution API
      // Muitas vezes é aceito no formato 5511999999999 ou 5511999999999@c.us
      const formattedContactId = normalizedContactId.includes('@') 
        ? normalizedContactId 
        : `${normalizedContactId}@c.us`;
      
      const messagesResult = await evolutionClient.getMessages(formattedContactId);
      
      if (!messagesResult || !messagesResult.messages) {
        return res.status(200).json({
          success: true,
          messages: [] // Retornar um array vazio se não houver mensagens
        });
      }
      
      // Processar e formatar mensagens
      const messages = messagesResult.messages.map((msg: any) => {
        // Formatar conforme o esquema definido
        return {
          id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
          contactId: contactId,
          content: msg.body || msg.content || "",
          timestamp: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
          isIncoming: msg.fromMe === false,
          status: msg.status || 'sent',
          type: msg.type || 'text'
        };
      });
      
      // Ordenar mensagens por timestamp
      const sortedMessages = messages.sort((a: Message, b: Message) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      );
      
      return res.status(200).json({
        success: true,
        messages: sortedMessages
      });
    } catch (messagesError) {
      console.error("Erro ao buscar mensagens do WhatsApp:", messagesError);
      return res.status(500).json({
        message: "Não foi possível buscar mensagens do WhatsApp",
        error: messagesError instanceof Error ? messagesError.message : "Erro desconhecido"
      });
    }
  } catch (error) {
    console.error("Erro no endpoint de mensagens do WhatsApp:", error);
    return res.status(500).json({
      message: "Erro interno do servidor ao processar mensagens do WhatsApp"
    });
  }
}

/**
 * Endpoint para enviar uma mensagem para um contato
 */
export async function sendWhatsAppMessage(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }
    
    // Validar dados da requisição
    const validationResult = SendMessageSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        message: "Dados inválidos para envio de mensagem",
        errors: validationResult.error.format()
      });
    }
    
    const { contactId, content, type } = validationResult.data;
    
    // Obter servidor associado ao usuário
    const server = await fetchUserServer(userId);
    
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        message: "Servidor do WhatsApp não configurado corretamente"
      });
    }
    
    // Criar cliente da Evolution API
    const instanceId = req.user.username;
    const evolutionClient = new EvolutionApiClient(
      server.apiUrl,
      server.apiToken,
      instanceId
    );
    
    // Verificar se está conectado
    try {
      const statusResult = await evolutionClient.checkConnectionStatus();
      
      if (!statusResult?.connected) {
        return res.status(400).json({
          message: "WhatsApp não está conectado. Conecte primeiro escaneando o QR code."
        });
      }
    } catch (statusError) {
      console.error("Erro ao verificar status da conexão:", statusError);
      return res.status(500).json({
        message: "Não foi possível verificar o status da conexão do WhatsApp"
      });
    }
    
    // Enviar mensagem
    try {
      console.log(`Enviando mensagem para o contato ${contactId}...`);
      
      // Normalizar número do contato
      const normalizedPhoneNumber = normalizePhoneNumber(contactId);
      
      let sendResult;
      if (type === 'text') {
        sendResult = await evolutionClient.sendTextMessage(normalizedPhoneNumber, content);
      } else {
        // Para futura implementação de outros tipos de mensagem
        return res.status(501).json({
          message: `Envio de mensagens do tipo '${type}' ainda não implementado`
        });
      }
      
      if (!sendResult || !sendResult.success) {
        console.error("Erro ao enviar mensagem:", sendResult);
        return res.status(500).json({
          message: "Não foi possível enviar a mensagem",
          error: sendResult?.error || "Erro desconhecido"
        });
      }
      
      // Registrar a mensagem no histórico (opcional)
      try {
        await db.insert(messageSendingHistory).values({
          userId: userId,
          phone: normalizedPhoneNumber,
          message: content,
          sentAt: new Date(),
          status: 'sent',
          whatsappConnectionType: 'qrcode',
          responseData: JSON.stringify(sendResult)
        });
      } catch (dbError) {
        console.error("Erro ao registrar mensagem no histórico:", dbError);
        // Não falhar a operação se o registro no banco falhar
      }
      
      // Retornar a mensagem enviada no formato padronizado
      const sentMessage: Message = {
        id: sendResult.messageId || `sent-${Date.now()}`,
        contactId: contactId,
        content: content,
        timestamp: new Date(),
        isIncoming: false,
        status: 'sent',
        type: 'text'
      };
      
      return res.status(200).json({
        success: true,
        message: sentMessage
      });
    } catch (sendError) {
      console.error("Erro ao enviar mensagem do WhatsApp:", sendError);
      return res.status(500).json({
        message: "Não foi possível enviar a mensagem do WhatsApp",
        error: sendError instanceof Error ? sendError.message : "Erro desconhecido"
      });
    }
  } catch (error) {
    console.error("Erro no endpoint de envio de mensagem do WhatsApp:", error);
    return res.status(500).json({
      message: "Erro interno do servidor ao enviar mensagem do WhatsApp"
    });
  }
}