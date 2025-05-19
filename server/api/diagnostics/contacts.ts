/**
 * Módulo de diagnóstico completo para WhatsApp 
 * Centraliza testes e verificações de endpoints para facilitar a depuração
 */

import { Request, Response } from 'express';
import axios from 'axios';

/**
 * Executa uma série de testes para diagnosticar problemas de conexão com a Evolution API
 */
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

    // Iniciar diagnóstico
    console.log('🔍 Iniciando diagnóstico de contatos do WhatsApp...');
    
    // Informações do servidor (sanitizadas para o log)
    const instanceId = server.instanceId || 'admin';
    const serverInfo = {
      id: server.id,
      name: server.name,
      apiUrl: server.apiUrl,
      instanceId: instanceId,
      tokenLength: server.apiToken.length
    };
    
    console.log('📋 Informações do servidor:', serverInfo);

    // 1. Testar conexão básica
    const connectionResults = await testConnection(server);
    
    // 2. Testar endpoints específicos
    const endpointResults = await testEndpoints(server);

    // 3. Resultado final
    const diagnostics = {
      server: serverInfo,
      connection: connectionResults,
      endpoints: endpointResults,
      timestamp: new Date()
    };

    // Retornar resultados
    return res.json({
      success: true,
      diagnostics
    });

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao executar diagnóstico',
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
    const { pool } = await import('../../db');
    
    // Consulta direta para buscar as informações necessárias
    const query = `
      SELECT 
        us.id, 
        us.user_id as userId, 
        us.server_id as serverId,
        s.name as name,
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

  const instanceId = server.instanceId || 'admin';
  
  // Teste 1: Verificar se a URL do servidor responde
  try {
    console.log(`🔄 Testando conexão básica com: ${server.apiUrl}`);
    const response = await axios.get(`${server.apiUrl}/status`, {
      timeout: 5000
    });
    results.baseConnection = response.status === 200;
    results.baseConnectionDetails = {
      status: response.status,
      data: response.data
    };
    console.log(`✅ Teste de conexão básica: ${results.baseConnection ? 'Sucesso' : 'Falha'}`);
  } catch (error) {
    console.error('❌ Erro na conexão básica:', error);
    results.baseConnectionDetails = {
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }

  // Teste 2: Verificar autenticação com token
  try {
    console.log(`🔄 Testando autenticação com token para: ${server.apiUrl}`);
    const response = await axios.get(`${server.apiUrl}/instance/info/${instanceId}`, {
      headers: {
        'Authorization': `Bearer ${server.apiToken}`,
        'apikey': server.apiToken
      },
      timeout: 5000
    });
    results.authTest = response.status === 200;
    results.authTestDetails = {
      status: response.status,
      data: response.data
    };
    console.log(`✅ Teste de autenticação: ${results.authTest ? 'Sucesso' : 'Falha'}`);
  } catch (error) {
    console.error('❌ Erro na autenticação:', error);
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
  const resultsMap: Record<string, any> = {};

  // Headers comuns para todos os requests
  const headers = {
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
  
  // Testar cada endpoint
  for (const endpoint of endpoints) {
    console.log(`🔄 Testando endpoint: ${endpoint.name} - ${endpoint.method} ${endpoint.url}`);
    resultsMap[endpoint.name] = { isSuccess: false };
    
    try {
      let response;
      
      if (endpoint.method === 'GET') {
        response = await axios.get(endpoint.url, { 
          headers,
          timeout: 8000
        });
      } else if (endpoint.method === 'POST') {
        // Para o endpoint findContacts, enviamos um objeto vazio para obter todos
        response = await axios.post(endpoint.url, {}, { 
          headers,
          timeout: 8000
        });
      }
      
      resultsMap[endpoint.name] = {
        isSuccess: true,
        status: response.status,
        statusText: response.statusText,
        data: response.data
      };
      console.log(`✅ Endpoint ${endpoint.name}: Sucesso (status ${response.status})`);
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        resultsMap[endpoint.name] = {
          isSuccess: false,
          status: error.response?.status || 0,
          statusText: error.response?.statusText || '',
          error: error.message,
          data: error.response?.data
        };
      } else {
        resultsMap[endpoint.name] = {
          isSuccess: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
      }
      console.log(`❌ Endpoint ${endpoint.name}: Falha - ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }
  
  return resultsMap;
}