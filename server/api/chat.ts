/**
 * Módulo de API para chat via WhatsApp
 * Implementa endpoints para listar contatos, buscar mensagens e enviar mensagens
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { EvolutionApiClient } from '../evolution-api';

const router = Router();

// Middleware para verificar autenticação
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ success: false, message: 'Não autenticado' });
  }
  next();
}

// Buscar o servidor para o usuário atual
async function getUserServer(userId: number) {
  try {
    // Aqui devemos buscar os dados do banco de dados
    // Usando uma consulta direta para simplificar e evitar erros com relações
    const query = `
      SELECT us.id, us.user_id as userId, us.server_id as serverId,
             s.api_url as apiUrl, s.api_token as apiToken,
             s.instance_id as instanceId
      FROM user_servers us
      JOIN servers s ON us.server_id = s.id
      WHERE us.user_id = $1
      LIMIT 1
    `;
    
    const { pool } = await import('../db');
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao buscar servidor do usuário:', error);
    return null;
  }
}

// Endpoint para listar contatos
router.get('/contacts', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não identificado' });
    }
    
    // Buscar informações do servidor do usuário
    const server = await getUserServer(userId);
    if (!server) {
      return res.status(404).json({ 
        success: false, 
        message: 'Servidor não configurado para este usuário'
      });
    }
    
    console.log('Servidor encontrado:', server);
    
    // Verificar se temos as informações necessárias
    if (!server.apiUrl || !server.apiToken || !server.instanceId) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta. Verifique a URL da API, token e ID da instância.'
      });
    }
    
    // Criar cliente da Evolution API
    const client = new EvolutionApiClient(
      server.apiUrl,
      server.apiToken,
      server.instanceId
    );
    
    // Buscar contatos
    const contacts = await client.getContacts();
    
    // Formatação dos contatos (adicionar campos úteis para a UI)
    const formattedContacts = contacts.map(contact => {
      // Extrair número do formato JID (exemplo: 5511999999999@c.us)
      const phone = contact.id?.replace(/(@.*$)/g, '') || '';
      
      return {
        ...contact,
        phone,
        pushname: contact.pushname || contact.name || phone,
        lastMessageTime: contact.lastMessageTime || null,
      };
    });
    
    return res.json({
      success: true,
      contacts: formattedContacts
    });
    
  } catch (error) {
    console.error('Erro ao listar contatos:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar contatos',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Endpoint para buscar mensagens de um contato
router.get('/messages/:contactId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não identificado' });
    }
    
    const { contactId } = req.params;
    if (!contactId) {
      return res.status(400).json({ success: false, message: 'ID do contato não informado' });
    }
    
    // Buscar informações do servidor do usuário
    const server = await getUserServer(userId);
    if (!server) {
      return res.status(404).json({ 
        success: false, 
        message: 'Servidor não configurado para este usuário'
      });
    }
    
    // Verificar se temos as informações necessárias
    if (!server.apiUrl || !server.apiToken || !server.instanceId) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta. Verifique a URL da API, token e ID da instância.'
      });
    }
    
    // Criar cliente da Evolution API
    const client = new EvolutionApiClient(
      server.apiUrl,
      server.apiToken,
      server.instanceId
    );
    
    // Adicionar JID ao formato do contato se não estiver no formato correto
    const formattedContactId = contactId.includes('@') 
      ? contactId 
      : `${contactId}@c.us`;
    
    // Buscar as mensagens
    // Nota: Implementação real depende da API da Evolution
    // Vamos usar um endpoint direto da API
    const response = await axios.get(
      `${server.apiUrl}/instances/${server.instanceId}/chat/messages/${formattedContactId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${server.apiToken}`
        }
      }
    );
    
    // Verificar resposta e formatar mensagens
    if (response.data && response.data.messages) {
      // Formatar as mensagens no formato esperado pela UI
      const messages = response.data.messages.map((msg: any) => ({
        id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        fromMe: msg.fromMe || msg.key?.fromMe || false,
        body: msg.message?.conversation || msg.body || msg.message?.extendedTextMessage?.text || '',
        timestamp: msg.messageTimestamp || msg.timestamp || Date.now(),
        status: msg.status || 'enviado',
      }));
      
      return res.json({
        success: true,
        messages
      });
    } else {
      return res.json({
        success: true,
        messages: []
      });
    }
    
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar mensagens',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Endpoint para enviar mensagem
router.post('/send', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não identificado' });
    }
    
    const { contactId, message } = req.body;
    
    if (!contactId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Contato e mensagem são obrigatórios'
      });
    }
    
    // Buscar informações do servidor do usuário
    const server = await getUserServer(userId);
    if (!server) {
      return res.status(404).json({ 
        success: false, 
        message: 'Servidor não configurado para este usuário'
      });
    }
    
    // Verificar se temos as informações necessárias
    if (!server.apiUrl || !server.apiToken || !server.instanceId) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta. Verifique a URL da API, token e ID da instância.'
      });
    }
    
    // Criar cliente da Evolution API
    const client = new EvolutionApiClient(
      server.apiUrl,
      server.apiToken,
      server.instanceId
    );
    
    // Formatar número de telefone para o padrão esperado
    // Remover "@c.us" se presente
    let phone = contactId.replace(/@.*$/, '');
    
    // Enviar mensagem
    const result = await client.sendTextMessage(phone, message);
    
    if (result && result.key) {
      return res.json({
        success: true,
        message: 'Mensagem enviada com sucesso',
        messageId: result.key.id,
        result
      });
    } else {
      return res.json({
        success: true,
        message: 'Mensagem processada, mas sem confirmação de entrega',
        result
      });
    }
    
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao enviar mensagem',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default router;