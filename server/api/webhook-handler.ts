/**
 * Manipulador de webhooks para sincronização de contatos do WhatsApp
 * Recebe solicitações externas da Evolution API
 */

import { Request, Response } from 'express';
import { pool } from '../db';
import axios from 'axios';

/**
 * Processa webhooks do formato:
 * GET /webhook/find/{instance}
 * 
 * Conforme documentação fornecida pelo cliente
 */
export async function handleFindWebhook(req: Request, res: Response) {
  try {
    const instanceId = req.params.instance;
    const apiKey = req.headers['apikey'] as string;
    
    // Validar parâmetros obrigatórios
    if (!instanceId) {
      return res.status(400).json({
        success: false,
        message: 'ID da instância é obrigatório'
      });
    }
    
    if (!apiKey) {
      return res.status(401).json({
        success: false, 
        message: 'API key não fornecida'
      });
    }
    
    // Verificar se a chave API é válida
    const server = await getServerByApiKey(apiKey);
    if (!server) {
      return res.status(401).json({
        success: false,
        message: 'API key inválida'
      });
    }
    
    console.log(`[WEBHOOK] Solicitação de sincronização recebida para instância: ${instanceId}`);
    
    // Iniciar a sincronização de contatos em background
    synchronizeContacts(server, instanceId)
      .then(result => {
        console.log(`[WEBHOOK] Sincronização concluída: ${result.message}`);
      })
      .catch(error => {
        console.error('[WEBHOOK] Erro na sincronização:', error);
      });
    
    // Responder ao webhook imediatamente
    return res.status(200).json({
      success: true,
      message: 'Solicitação de sincronização recebida e em processamento',
      instanceId
    });
    
  } catch (error) {
    console.error('[WEBHOOK] Erro ao processar webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao processar webhook',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Busca servidor pelo apiKey
 */
async function getServerByApiKey(apiKey: string) {
  try {
    // Consulta direta para verificar a existência do servidor com o apiKey fornecido
    const query = `
      SELECT 
        id, 
        name,
        api_url as "apiUrl", 
        api_token as "apiToken",
        instance_id as "instanceId"
      FROM 
        servers
      WHERE 
        api_token = $1
      LIMIT 1
    `;
    
    const result = await pool.query(query, [apiKey]);
    
    if (result.rows.length === 0) {
      console.log('Nenhum servidor encontrado com este apiKey:', apiKey);
      return null;
    }
    
    return result.rows[0];
    
  } catch (error) {
    console.error('Erro ao buscar servidor pelo apiKey:', error);
    return null;
  }
}

/**
 * Função para sincronizar contatos usando o endpoint /chat/findContacts
 */
async function synchronizeContacts(server: any, instanceId: string) {
  try {
    // Configurações do servidor
    const serverInstanceId = server.instanceId || instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;
    
    // Endpoint conforme especificado na documentação
    const endpoint = `${apiUrl}/chat/findContacts/${serverInstanceId}`;
    
    console.log(`[SYNC] Iniciando sincronização de contatos usando: ${endpoint}`);
    
    // Realizar solicitação POST para /chat/findContacts/{instance}
    const response = await axios.post(
      endpoint, 
      {}, // Corpo vazio para obter todos os contatos
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'apikey': apiToken,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // Timeout maior para operações de sincronização
      }
    );
    
    // Verificar se recebemos uma resposta válida
    if (!response.data) {
      return {
        success: false,
        message: 'Resposta vazia do servidor'
      };
    }
    
    // Processar e verificar contatos
    let contactsCount = 0;
    if (Array.isArray(response.data)) {
      contactsCount = response.data.length;
    } else if (response.data.contacts && Array.isArray(response.data.contacts)) {
      contactsCount = response.data.contacts.length;
    } else if (response.data.response && Array.isArray(response.data.response)) {
      contactsCount = response.data.response.length;
    }
    
    return {
      success: true,
      message: `${contactsCount} contatos sincronizados com sucesso`,
      count: contactsCount
    };
    
  } catch (error) {
    console.error('[SYNC] Erro na sincronização via webhook:', error);
    
    const errorMessage = axios.isAxiosError(error) && error.response ? 
      `Erro ${error.response.status}: ${error.message}` : 
      `Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`;
    
    return {
      success: false,
      message: 'Não foi possível sincronizar os contatos',
      error: errorMessage
    };
  }
}