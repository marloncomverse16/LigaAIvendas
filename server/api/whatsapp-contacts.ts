/**
 * API para gerenciar contatos do WhatsApp
 * Fornece endpoints para listar e buscar contatos do WhatsApp
 */

import { Request, Response } from "express";
import { z } from "zod";
import { EvolutionApiClient } from "../evolution-api";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { userServers, servers, users } from "../../shared/schema";

// Esquema de validação para resposta de contatos
const ContactSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  phone: z.string(),
  lastMessage: z.string().nullable().optional(),
  lastMessageTime: z.date().nullable().optional(),
  unreadCount: z.number().nullable().optional().default(0),
  avatarUrl: z.string().nullable().optional(),
  isOnline: z.boolean().nullable().optional().default(false)
});

export type Contact = z.infer<typeof ContactSchema>;

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
 * Endpoint para listar todos os contatos do WhatsApp do usuário
 */
export async function listWhatsAppContacts(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "Usuário não encontrado" });
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
    
    // Buscar contatos
    try {
      console.log(`Buscando contatos do WhatsApp para o usuário ${userId}...`);
      const contactsResult = await evolutionClient.getContacts();
      
      if (!contactsResult || !contactsResult.contacts) {
        return res.status(404).json({
          message: "Nenhum contato encontrado ou resposta inválida da API"
        });
      }
      
      // Processar e formatar contatos
      const contacts = contactsResult.contacts.map((contact: any) => {
        // Formatar conforme o esquema definido
        return {
          id: contact.id || contact.wa_id || contact.phone,
          name: contact.name || contact.pushname || contact.shortName || null,
          phone: contact.id?.split("@")[0] || contact.phone,
          lastMessage: contact.lastMessage?.body || null,
          lastMessageTime: contact.lastMessage?.timestamp ? new Date(contact.lastMessage.timestamp * 1000) : null,
          unreadCount: contact.unreadCount || 0,
          avatarUrl: contact.avatar || null,
          isOnline: contact.presence === "available" || contact.status === "online" || false
        };
      });
      
      return res.status(200).json({
        success: true,
        contacts: contacts
      });
    } catch (contactsError) {
      console.error("Erro ao buscar contatos do WhatsApp:", contactsError);
      return res.status(500).json({
        message: "Não foi possível buscar contatos do WhatsApp",
        error: contactsError instanceof Error ? contactsError.message : "Erro desconhecido"
      });
    }
  } catch (error) {
    console.error("Erro no endpoint de contatos do WhatsApp:", error);
    return res.status(500).json({
      message: "Erro interno do servidor ao processar contatos do WhatsApp"
    });
  }
}

/**
 * Endpoint para buscar um contato específico
 */
export async function getWhatsAppContact(req: Request, res: Response) {
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
    
    // Buscar contatos e filtrar pelo ID
    try {
      const contactsResult = await evolutionClient.getContacts();
      
      if (!contactsResult || !contactsResult.contacts) {
        return res.status(404).json({
          message: "Nenhum contato encontrado ou resposta inválida da API"
        });
      }
      
      // Encontrar o contato específico
      const contactData = contactsResult.contacts.find((contact: any) => 
        contact.id === contactId || 
        contact.wa_id === contactId || 
        contact.phone === contactId ||
        contact.id?.split("@")[0] === contactId
      );
      
      if (!contactData) {
        return res.status(404).json({
          message: "Contato não encontrado"
        });
      }
      
      // Formatar o contato
      const contact = {
        id: contactData.id || contactData.wa_id || contactData.phone,
        name: contactData.name || contactData.pushname || contactData.shortName || null,
        phone: contactData.id?.split("@")[0] || contactData.phone,
        lastMessage: contactData.lastMessage?.body || null,
        lastMessageTime: contactData.lastMessage?.timestamp ? new Date(contactData.lastMessage.timestamp * 1000) : null,
        unreadCount: contactData.unreadCount || 0,
        avatarUrl: contactData.avatar || null,
        isOnline: contactData.presence === "available" || contactData.status === "online" || false
      };
      
      return res.status(200).json({
        success: true,
        contact
      });
    } catch (error) {
      console.error("Erro ao buscar contato do WhatsApp:", error);
      return res.status(500).json({
        message: "Não foi possível buscar o contato do WhatsApp",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  } catch (error) {
    console.error("Erro no endpoint de contato do WhatsApp:", error);
    return res.status(500).json({
      message: "Erro interno do servidor ao processar contato do WhatsApp"
    });
  }
}