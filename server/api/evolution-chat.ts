/**
 * Implementação das funções de Chat da Evolution API
 * Baseado na documentação oficial da Evolution API
 */

import { Request, Response } from 'express';
import axios from 'axios';

/**
 * Busca contatos do WhatsApp usando o endpoint correto
 * POST /chat/findContacts/{instance}
 */
export async function findContacts(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        message: 'Não autenticado' 
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não identificado' 
      });
    }

    // Buscar informações do servidor
    const server = await getUserServer(userId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Servidor não configurado para este usuário'
      });
    }

    // Verificar se temos configurações completas
    if (!server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta. Verifique a URL da API e token.'
      });
    }

    const instanceId = server.instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;

    console.log(`Buscando contatos do WhatsApp: ${apiUrl}/chat/findContacts/${instanceId}`);

    // Fazer a chamada para a API Evolution
    const response = await axios.post(
      `${apiUrl}/chat/findContacts/${instanceId}`,
      {}, // Corpo vazio para buscar todos os contatos
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'apikey': apiToken
        },
        timeout: 10000
      }
    );

    // Verificar e processar a resposta
    if (response.data) {
      let contacts = [];
      
      // Processar diferentes formatos de resposta
      if (Array.isArray(response.data)) {
        contacts = response.data;
      } else if (response.data.contacts && Array.isArray(response.data.contacts)) {
        contacts = response.data.contacts;
      } else if (response.data.response && Array.isArray(response.data.response)) {
        contacts = response.data.response;
      } else if (typeof response.data === 'object') {
        // Tentar extrair contatos de alguma propriedade do objeto
        const possibleArrays = Object.values(response.data).filter(
          val => Array.isArray(val) && val.length > 0
        ) as any[][];
        
        if (possibleArrays.length > 0) {
          // Usar o maior array como lista de contatos
          contacts = possibleArrays.reduce((a, b) => a.length > b.length ? a : b);
        }
      }

      return res.json({
        success: true,
        contacts: contacts,
        total: contacts.length
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'Nenhum contato encontrado'
      });
    }
  } catch (error) {
    console.error('Erro ao buscar contatos:', error);
    
    const errorMessage = axios.isAxiosError(error) && error.response
      ? `Erro ${error.response.status}: ${error.message}`
      : `Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`;
    
    return res.status(500).json({
      success: false,
      message: 'Não foi possível obter os contatos do WhatsApp',
      error: errorMessage
    });
  }
}

/**
 * Verifica se um número está registrado no WhatsApp
 * POST /chat/whatsappNumbers/{instance}
 */
export async function checkWhatsAppNumbers(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }
    
    const userId = req.user?.id;
    const { numbers } = req.body;
    
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'É necessário fornecer pelo menos um número para verificação'
      });
    }
    
    // Buscar informações do servidor
    const server = await getUserServer(userId);
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta'
      });
    }
    
    const instanceId = server.instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;
    
    console.log(`Verificando ${numbers.length} números no WhatsApp`);
    
    const response = await axios.post(
      `${apiUrl}/chat/whatsappNumbers/${instanceId}`,
      { numbers },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'apikey': apiToken
        },
        timeout: 10000
      }
    );
    
    return res.json({
      success: true,
      results: response.data
    });
    
  } catch (error) {
    console.error('Erro ao verificar números no WhatsApp:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar números no WhatsApp',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Busca mensagens do WhatsApp
 * POST /chat/findMessages/{instance}
 */
export async function findMessages(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }
    
    const userId = req.user?.id;
    const { where = {} } = req.body;
    
    // Buscar informações do servidor
    const server = await getUserServer(userId);
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta'
      });
    }
    
    const instanceId = server.instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;
    
    console.log(`Buscando mensagens no WhatsApp com filtro:`, where);
    
    const response = await axios.post(
      `${apiUrl}/chat/findMessages/${instanceId}`,
      { where },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'apikey': apiToken
        },
        timeout: 10000
      }
    );
    
    return res.json({
      success: true,
      messages: response.data
    });
    
  } catch (error) {
    console.error('Erro ao buscar mensagens no WhatsApp:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar mensagens no WhatsApp',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Busca chats do WhatsApp
 * POST /chat/findChats/{instance}
 */
export async function findChats(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }
    
    const userId = req.user?.id;
    const { where = {} } = req.body;
    
    // Buscar informações do servidor
    const server = await getUserServer(userId);
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta'
      });
    }
    
    const instanceId = server.instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;
    
    console.log(`Buscando chats no WhatsApp`);
    
    const response = await axios.post(
      `${apiUrl}/chat/findChats/${instanceId}`,
      { where },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'apikey': apiToken
        },
        timeout: 10000
      }
    );
    
    return res.json({
      success: true,
      chats: response.data
    });
    
  } catch (error) {
    console.error('Erro ao buscar chats no WhatsApp:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar chats no WhatsApp',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Marca mensagem como lida
 * POST /chat/markMessageAsRead/{instance}
 */
export async function markMessageAsRead(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }
    
    const userId = req.user?.id;
    const { messageId } = req.body;
    
    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: 'ID da mensagem é obrigatório'
      });
    }
    
    // Buscar informações do servidor
    const server = await getUserServer(userId);
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta'
      });
    }
    
    const instanceId = server.instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;
    
    console.log(`Marcando mensagem como lida: ${messageId}`);
    
    const response = await axios.post(
      `${apiUrl}/chat/markMessageAsRead/${instanceId}`,
      { messageId },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'apikey': apiToken
        },
        timeout: 10000
      }
    );
    
    return res.json({
      success: true,
      result: response.data
    });
    
  } catch (error) {
    console.error('Erro ao marcar mensagem como lida:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao marcar mensagem como lida',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Obtém a URL da foto de perfil de um contato
 * POST /chat/fetchProfilePictureUrl/{instance}
 */
export async function fetchProfilePictureUrl(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }
    
    const userId = req.user?.id;
    const { number } = req.body;
    
    if (!number) {
      return res.status(400).json({
        success: false,
        message: 'Número de telefone é obrigatório'
      });
    }
    
    // Buscar informações do servidor
    const server = await getUserServer(userId);
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta'
      });
    }
    
    const instanceId = server.instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;
    
    console.log(`Buscando foto de perfil para: ${number}`);
    
    const response = await axios.post(
      `${apiUrl}/chat/fetchProfilePictureUrl/${instanceId}`,
      { number },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'apikey': apiToken
        },
        timeout: 10000
      }
    );
    
    return res.json({
      success: true,
      profilePictureUrl: response.data
    });
    
  } catch (error) {
    console.error('Erro ao buscar foto de perfil:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar foto de perfil',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Busca as informações do servidor do usuário
 */
async function getUserServer(userId: number) {
  try {
    // Importar o pool diretamente para evitar problemas com o ORM
    const { pool } = await import('../db');
    
    // Consulta direta para buscar as informações necessárias
    const query = `
      SELECT 
        us.id, 
        us.user_id as userId, 
        us.server_id as serverId,
        s.api_url as "apiUrl", 
        s.api_token as "apiToken",
        s.instance_id as "instanceId"
      FROM 
        user_servers us
      JOIN 
        servers s ON us.server_id = s.id
      WHERE 
        us.user_id = $1
      LIMIT 1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      console.log('Nenhum servidor encontrado para o usuário:', userId);
      return null;
    }
    
    return result.rows[0];
    
  } catch (error) {
    console.error('Erro ao buscar servidor do usuário:', error);
    return null;
  }
}