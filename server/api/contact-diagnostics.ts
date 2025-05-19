/**
 * Módulo de diagnóstico para identificar problemas na obtenção de contatos
 * Testa múltiplos endpoints e configurações para determinar o que está funcionando
 */

import { Request, Response } from 'express';
import axios from 'axios';

export async function runContactDiagnostics(req: Request, res: Response) {
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

    // Resultados dos testes
    const results = {
      server: {
        apiUrl: server.apiUrl,
        instanceId: server.instanceId || 'admin',
        tokenLength: server.apiToken.length,
      },
      connection: await testConnection(server),
      endpoints: await testEndpoints(server),
    };

    return res.json({
      success: true,
      diagnostics: results
    });

  } catch (error) {
    console.error('Erro ao executar diagnóstico:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao executar diagnóstico',
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

/**
 * Testa a conexão básica com a Evolution API
 */
async function testConnection(server: any) {
  const results = {
    baseConnection: false,
    baseConnectionDetails: null,
    authTest: false,
    authTestDetails: null
  };

  try {
    // Teste básico - apenas verificar se conseguimos acessar a API
    const response = await axios.get(server.apiUrl, {
      validateStatus: () => true
    });
    
    results.baseConnection = response.status < 400;
    results.baseConnectionDetails = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: typeof response.data === 'string' && response.data.length > 1000 
        ? response.data.substring(0, 1000) + '...' 
        : response.data
    };
  } catch (error) {
    results.baseConnectionDetails = {
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }

  try {
    // Teste com autenticação
    const response = await axios.get(`${server.apiUrl}/instance/info/${server.instanceId || 'admin'}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${server.apiToken}`,
        'apikey': server.apiToken
      },
      validateStatus: () => true
    });
    
    results.authTest = response.status < 400;
    results.authTestDetails = {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    };
  } catch (error) {
    results.authTestDetails = {
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }

  return results;
}

/**
 * Testa múltiplos endpoints para determinar quais estão funcionando
 */
async function testEndpoints(server: any) {
  const instanceId = server.instanceId || 'admin';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${server.apiToken}`,
    'apikey': server.apiToken
  };

  // Lista de endpoints a testar
  const endpoints = [
    { name: 'check', url: `${server.apiUrl}/instance/connect/${instanceId}`, method: 'GET' },
    { name: 'info', url: `${server.apiUrl}/instance/info/${instanceId}`, method: 'GET' },
    { name: 'contacts_standard', url: `${server.apiUrl}/instance/fetchContacts/${instanceId}`, method: 'GET' },
    { name: 'contacts_all', url: `${server.apiUrl}/instance/fetchAllContacts/${instanceId}`, method: 'GET' },
    { name: 'contacts_alternative', url: `${server.apiUrl}/instances/${instanceId}/contacts`, method: 'GET' },
    { name: 'chats', url: `${server.apiUrl}/instance/chats/${instanceId}`, method: 'GET' },
    { name: 'connection_state_1', url: `${server.apiUrl}/instance/connectionState/${instanceId}`, method: 'GET' },
    { name: 'connection_state_2', url: `${server.apiUrl}/manager/instance/connectionState/${instanceId}`, method: 'GET' },
    { name: 'status', url: `${server.apiUrl}/status`, method: 'GET' },
    { name: 'metadata', url: `${server.apiUrl}/instance/connectionState/${instanceId}/metadata`, method: 'GET' },
    // Novo endpoint conforme documentação oficial
    { name: 'find_contacts', url: `${server.apiUrl}/chat/findContacts/${instanceId}`, method: 'POST' },
  ];

  const results: Record<string, any> = {};
  
  // Testar cada endpoint
  for (const endpoint of endpoints) {
    try {
      const response = await axios({
        method: endpoint.method,
        url: endpoint.url,
        headers,
        validateStatus: () => true,
        timeout: 5000 // Timeout de 5 segundos
      });
      
      results[endpoint.name] = {
        status: response.status,
        statusText: response.statusText,
        isSuccess: response.status < 400,
        dataType: typeof response.data,
        dataPreview: typeof response.data === 'string' && response.data.length > 500
          ? response.data.substring(0, 500) + '...'
          : response.data,
      };
    } catch (error) {
      results[endpoint.name] = {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        isSuccess: false
      };
    }
  }

  return results;
}