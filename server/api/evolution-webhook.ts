/**
 * Módulo para configuração de webhooks da Evolution API
 * Implementa endpoints para ativar as opções de webhook e definir a URL
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

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
    // Importar o pool diretamente para evitar problemas com o ORM
    const { pool } = await import('../db');
    
    // Consulta direta para buscar as informações necessárias
    const query = `
      SELECT 
        us.id, 
        us.user_id as userid, 
        us.server_id as serverid,
        s.api_url as apiurl, 
        s.api_token as apitoken,
        s.instance_id as instanceid,
        us.webhook_url as webhookurl
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
    
    console.log('Servidor encontrado:', result.rows[0]);
    return result.rows[0];
    
  } catch (error) {
    console.error('Erro ao buscar servidor do usuário:', error);
    return null;
  }
}

// Endpoint para ativar todas as opções de webhook
router.post('/activate-all', requireAuth, async (req: Request, res: Response) => {
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
    
    console.log('Configurações do servidor:', {
      url: server.apiurl,
      token: server.apitoken,
      instance: server.instanceid
    });
    
    // Verificar se temos as informações necessárias
    if (!server.apiurl || !server.apitoken || !server.instanceid) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta. Verifique a URL da API, token e ID da instância.'
      });
    }
    
    // Preparar dados para ativar os webhooks
    const webhookSettings = {
      instanceName: server.instanceid,
      events: {
        INSTANCE_CREATE: true,
        INSTANCE_DELETE: true,
        INSTANCE_STATUS: true,
        QRCODE_UPDATED: true,
        MESSAGES_SET: true,
        MESSAGES_UPSERT: true,
        MESSAGES_UPDATE: true,
        MESSAGES_DELETE: true,
        SEND_MESSAGE: true,
        CONTACTS_SET: true,
        CONTACTS_UPSERT: true,
        CONTACTS_UPDATE: true,
        PRESENCE_UPDATE: true,
        CHATS_SET: true,
        CHATS_UPSERT: true,
        CHATS_UPDATE: true,
        CHATS_DELETE: true,
        GROUPS_UPSERT: true,
        GROUP_UPDATE: true,
        GROUP_PARTICIPANTS_UPDATE: true,
        CONNECTION_UPDATE: true,
        CALL: true,
        NEW_JWT_TOKEN: true
      },
      webhook_base64: true,
      webhook_by_events: true
    };
    
    console.log('Configurando webhooks para a instância:', server.instanceid);
    console.log('Dados de configuração:', JSON.stringify(webhookSettings));
    
    // Listar possíveis endpoints para configurar webhooks
    const endpoints = [
      `${server.apiurl}/instance/webhook/${server.instanceid}`,
      `${server.apiurl}/webhook/${server.instanceid}`,
      `${server.apiurl}/instance/webhooks/${server.instanceid}`,
      `${server.apiurl}/webhook/enable/${server.instanceid}`
    ];
    
    let webhookConfigured = false;
    let webhookResponse = null;
    
    // Tentar cada endpoint até um funcionar
    for (const endpoint of endpoints) {
      try {
        console.log(`Tentando configurar webhook em: ${endpoint}`);
        
        const response = await axios.post(endpoint, webhookSettings, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${server.apitoken}`,
            'apikey': server.apitoken,
            'AUTHENTICATION_API_KEY': server.apitoken
          },
          timeout: 10000
        });
        
        if (response.status >= 200 && response.status < 300) {
          console.log(`Webhook configurado com sucesso no endpoint: ${endpoint}`);
          console.log('Resposta:', response.data);
          webhookConfigured = true;
          webhookResponse = response.data;
          break;
        }
      } catch (error) {
        console.log(`Erro ao configurar webhook em ${endpoint}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    if (webhookConfigured) {
      return res.status(200).json({
        success: true,
        message: 'Webhook configurado com sucesso',
        data: webhookResponse
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'Não foi possível configurar o webhook. Tente novamente mais tarde.'
    });
    
  } catch (error) {
    console.error('Erro ao configurar webhook:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({
      success: false,
      message: 'Erro ao configurar webhook',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Endpoint para definir a URL do webhook
router.post('/set-url', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não identificado' });
    }
    
    const { webhookUrl } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        message: 'URL do webhook não fornecida'
      });
    }
    
    // Validar a URL (não deve ser localhost)
    if (webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1')) {
      return res.status(400).json({
        success: false,
        message: 'A URL do webhook não pode ser um endereço local (localhost)'
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
    if (!server.apiurl || !server.apitoken || !server.instanceid) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta. Verifique a URL da API, token e ID da instância.'
      });
    }
    
    // Preparar dados para definir a URL do webhook
    const webhookUrlData = {
      instanceName: server.instanceid,
      url: webhookUrl
    };
    
    console.log(`Configurando URL do webhook para a instância ${server.instanceid}:`, webhookUrl);
    
    // Listar possíveis endpoints para definir a URL do webhook
    const endpoints = [
      `${server.apiurl}/instance/webhook/${server.instanceid}/url`,
      `${server.apiurl}/webhook/${server.instanceid}/url`,
      `${server.apiurl}/instance/webhooks/${server.instanceid}/url`,
      `${server.apiurl}/webhook/url/${server.instanceid}`
    ];
    
    let urlConfigured = false;
    let urlResponse = null;
    
    // Tentar cada endpoint até um funcionar
    for (const endpoint of endpoints) {
      try {
        console.log(`Tentando configurar URL do webhook em: ${endpoint}`);
        
        const response = await axios.post(endpoint, webhookUrlData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${server.apitoken}`,
            'apikey': server.apitoken,
            'AUTHENTICATION_API_KEY': server.apitoken
          },
          timeout: 10000
        });
        
        if (response.status >= 200 && response.status < 300) {
          console.log(`URL do webhook configurada com sucesso no endpoint: ${endpoint}`);
          console.log('Resposta:', response.data);
          urlConfigured = true;
          urlResponse = response.data;
          break;
        }
      } catch (error) {
        console.log(`Erro ao configurar URL do webhook em ${endpoint}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    if (urlConfigured) {
      // Atualizar a URL do webhook no banco de dados
      try {
        const updateQuery = `
          UPDATE user_servers
          SET webhook_url = $1
          WHERE user_id = $2
          RETURNING id
        `;
        
        const { pool } = await import('../db');
        const updateResult = await pool.query(updateQuery, [webhookUrl, userId]);
        
        if (updateResult.rows.length > 0) {
          console.log('URL do webhook atualizada no banco de dados');
        }
      } catch (dbError) {
        console.error('Erro ao atualizar URL do webhook no banco de dados:', dbError);
      }
      
      return res.status(200).json({
        success: true,
        message: 'URL do webhook configurada com sucesso',
        data: urlResponse
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'Não foi possível configurar a URL do webhook. Tente novamente mais tarde.'
    });
    
  } catch (error) {
    console.error('Erro ao configurar URL do webhook:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({
      success: false,
      message: 'Erro ao configurar URL do webhook',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default router;