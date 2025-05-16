import { Router } from "express";
import { storage } from "../storage";
import { EvolutionApiClient } from "../evolution-api";

const router = Router();

// Obter contatos do WhatsApp
router.get("/contacts", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Não autenticado" });
    }
    
    const userId = req.user.id;
    
    // Obter servidor do usuário
    const userServers = await storage.getUserServers(userId);
    
    if (!userServers || userServers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Nenhum servidor configurado para o usuário"
      });
    }
    
    const serverRelation = userServers[0];
    const server = serverRelation?.server;
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: "Servidor não encontrado"
      });
    }
    
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;
    
    if (!apiUrl || !apiToken) {
      return res.status(400).json({
        success: false,
        message: "Servidor não configurado corretamente (URL da API ou token faltando)"
      });
    }
    
    console.log(`Buscando contatos do WhatsApp para o usuário ${userId}`);
    console.log(`Usando nome do usuário (${req.user.username}) como instância`);
    
    // Criar cliente Evolution API
    const evolutionClient = new EvolutionApiClient(
      apiUrl,
      apiToken,
      req.user.username || 'admin' // Usar username do usuário como instância ou 'admin' se não tiver
    );
    
    // Obter contatos
    const result = await evolutionClient.getContacts();
    
    if (!result.success) {
      console.error("Erro ao obter contatos:", result.error);
      return res.status(500).json({
        success: false,
        message: result.error || "Erro ao obter contatos da API"
      });
    }
    
    // Formatar os contatos para o cliente
    const contacts = (result.contacts || []).map(contact => {
      return {
        id: contact.id || contact.jid || contact.wa_id || contact.number,
        name: contact.name || contact.displayName || contact.pushname || 'Desconhecido',
        phone: contact.number || (contact.jid ? contact.jid.replace(/@.*$/, '') : ''),
        avatar: contact.profilePicture || null,
        lastMessage: contact.lastMessage || null,
        lastMessageTime: contact.lastMessageTime || null,
        unreadCount: contact.unreadCount || 0
      };
    });
    
    return res.json({
      success: true,
      contacts: contacts
    });
    
  } catch (error) {
    console.error("Erro ao buscar contatos do WhatsApp:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Erro interno ao buscar contatos"
    });
  }
});

// Obter mensagens de um contato específico
router.get("/messages/:contactId", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Não autenticado" });
    }
    
    const userId = req.user.id;
    const contactId = req.params.contactId;
    
    if (!contactId) {
      return res.status(400).json({
        success: false,
        message: "ID do contato é obrigatório"
      });
    }
    
    // Obter servidor do usuário
    const userServers = await storage.getUserServers(userId);
    
    if (!userServers || userServers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Nenhum servidor configurado para o usuário"
      });
    }
    
    const serverRelation = userServers[0];
    const server = serverRelation?.server;
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: "Servidor não encontrado"
      });
    }
    
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;
    
    if (!apiUrl || !apiToken) {
      return res.status(400).json({
        success: false,
        message: "Servidor não configurado corretamente (URL da API ou token faltando)"
      });
    }
    
    console.log(`Buscando mensagens para o contato ${contactId} do usuário ${userId}`);
    
    // Criar cliente Evolution API
    const evolutionClient = new EvolutionApiClient(
      apiUrl,
      apiToken,
      req.user.username || 'admin' // Usar username do usuário como instância ou 'admin' se não tiver
    );
    
    // Obter mensagens do contato
    // Este método precisa ser implementado no EvolutionApiClient
    const chat = await evolutionClient.getChatMessages(contactId);
    
    if (!chat.success) {
      console.error("Erro ao obter mensagens:", chat.error);
      return res.status(500).json({
        success: false,
        message: chat.error || "Erro ao obter mensagens da API"
      });
    }
    
    // Formatar as mensagens para o cliente
    const messages = (chat.messages || []).map(msg => {
      return {
        id: msg.id,
        content: msg.body || msg.content || msg.message || "",
        from: msg.fromMe ? 'me' : 'contact',
        timestamp: new Date(msg.timestamp || msg.time || Date.now()),
        status: msg.status || (msg.fromMe ? 'enviado' : undefined)
      };
    });
    
    return res.json({
      success: true,
      messages: messages
    });
    
  } catch (error) {
    console.error("Erro ao buscar mensagens do contato:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Erro interno ao buscar mensagens"
    });
  }
});

// Enviar mensagem para um contato
router.post("/send", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Não autenticado" });
    }
    
    const userId = req.user.id;
    const { contactId, message } = req.body;
    
    if (!contactId || !message) {
      return res.status(400).json({
        success: false,
        message: "ID do contato e mensagem são obrigatórios"
      });
    }
    
    // Obter servidor do usuário
    const userServers = await storage.getUserServers(userId);
    
    if (!userServers || userServers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Nenhum servidor configurado para o usuário"
      });
    }
    
    const serverRelation = userServers[0];
    const server = serverRelation?.server;
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: "Servidor não encontrado"
      });
    }
    
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;
    
    if (!apiUrl || !apiToken) {
      return res.status(400).json({
        success: false,
        message: "Servidor não configurado corretamente (URL da API ou token faltando)"
      });
    }
    
    console.log(`Enviando mensagem para o contato ${contactId} do usuário ${userId}`);
    
    // Criar cliente Evolution API
    const evolutionClient = new EvolutionApiClient(
      apiUrl,
      apiToken,
      req.user.username || 'admin' // Usar username do usuário como instância ou 'admin' se não tiver
    );
    
    // Formatar número de telefone para padrão internacional se for necessário
    const phoneNumber = contactId.includes('@')
      ? contactId // Se já estiver no formato jid (com @), usa como está
      : contactId.replace(/[^0-9]/g, ''); // Remove tudo que não for número
      
    // Enviar mensagem
    const result = await evolutionClient.sendTextMessage(phoneNumber, message);
    
    if (!result.success) {
      console.error("Erro ao enviar mensagem:", result.error);
      return res.status(500).json({
        success: false,
        message: result.error || "Erro ao enviar mensagem"
      });
    }
    
    return res.json({
      success: true,
      message: "Mensagem enviada com sucesso",
      messageId: result.messageId,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Erro interno ao enviar mensagem"
    });
  }
});

export default router;