/**
 * API para gerenciamento de conexões WhatsApp
 */
import { Request, Response } from "express";
import axios from "axios";
import { storage } from "../storage";

// Token padrão de fallback (usar apenas para testes)
const DEFAULT_TOKEN = "4db623449606bcf2814521b73657dbc0";

/**
 * Obtém o QR Code para conexão com WhatsApp via QR Code
 * Baseado na documentação da API Evolution v2.2.3
 */
export async function getWhatsAppQrCode(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    // Buscar servidor do usuário
    const userId = req.user?.id;
    const server = await fetchUserServer(userId);
    
    if (!server) {
      return res.status(404).json({ error: "Servidor não encontrado" });
    }

    // Dados necessários para a conexão
    const { apiUrl, apiToken, instanceId } = server;
    const baseUrl = apiUrl.replace(/\/+$/, '');
    const token = apiToken || process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN;
    const instance = instanceId || req.user?.username || 'admin';
    
    console.log(`Tentando conexão direta:
      URL: ${baseUrl}
      Instância: ${instance}
      Token: ${token ? token.substring(0, 5) + '...' + token.substring(token.length - 5) : 'não definido'}
    `);
    
    // Importante: Primeiro tente criar a instância se ela não existir
    try {
      // 1. Verificar se a instância existe e excluí-la se necessário
      try {
        console.log(`Verificando se a instância ${instance} existe...`);
        await axios.delete(`${baseUrl}/instance/delete/${instance}`, {
          headers: {
            'Content-Type': 'application/json',
            'apikey': token
          }
        });
        console.log(`Instância ${instance} excluída com sucesso ou não existia`);
      } catch (deleteError) {
        console.log(`Erro ao excluir instância (possivelmente não existia): ${deleteError.message}`);
      }
      
      // 2. Criar uma nova instância
      const createEndpoint = `${baseUrl}/instance/create`;
      console.log(`Criando instância: ${createEndpoint}`);
      
      const createData = {
        instanceName: instance,
        token: token,
        webhook: null,
        webhookByEvents: false,
        integration: "WHATSAPP-BAILEYS", 
        language: "pt-BR",
        qrcode: true
      };
      
      await axios.post(createEndpoint, createData, { 
        headers: {
          'Content-Type': 'application/json',
          'apikey': token
        }
      });
      
      console.log('Instância criada com sucesso');
    } catch (createError) {
      console.log('Erro ao criar instância:', createError.message);
      // Continuar mesmo com erro, pois a instância pode já existir
    }

    // Headers de autenticação (importante: 'apikey' é o formato correto para v2.2.3)
    const headers = {
      'Content-Type': 'application/json',
      'apikey': token,
      'Authorization': `Bearer ${token}`
    };

    // Endpoint específico para iniciar conexão baseado na documentação da API v2.2.3
    const endpoint = `${baseUrl}/instance/connect/${instance}`;
    console.log(`Fazendo requisição GET para o endpoint Instance Connect: ${endpoint}`);
    
    // Fazer requisição direta para o endpoint que sabemos que funciona
    const response = await axios.get(endpoint, { 
      headers, 
      timeout: 10000 
    });
    
    console.log(`Resposta obtida: Status ${response.status}`);
    
    // Verificar se a resposta contém HTML (erro comum)
    const responseStr = typeof response.data === 'string' 
      ? response.data 
      : JSON.stringify(response.data);
        
    if (responseStr.includes('<!DOCTYPE html>') || 
        responseStr.includes('<html') || 
        responseStr.includes('<body')) {
      console.log('Resposta contém HTML, erro de autenticação ou permissão');
      return res.status(400).json({ 
        error: 'API retornou HTML em vez de QR code. Verifique token e configurações.'
      });
    }
    
    // Extrair QR code da resposta - o formato varia dependendo da versão da API
    // Na versão 2.2.3, o QR code geralmente vem em response.data.code, então priorizamos esse campo
    console.log('Analisando resposta para extrair QR code. Estrutura:', JSON.stringify(response.data).substring(0, 300) + '...');
    
    const qrCode = response.data?.code || 
                   response.data?.qrcode || 
                   response.data?.qrCode || 
                   response.data?.base64 || 
                   (typeof response.data === 'string' ? response.data : null);
    
    if (qrCode) {
      console.log('QR Code obtido com sucesso!');
      return res.status(200).json({ 
        success: true,
        connected: false,
        qrCode: qrCode
      });
    } else if (response.data?.state === 'open' || 
              response.data?.state === 'connected' ||
              response.data?.connected === true) {
      console.log('Instância já está conectada');
      return res.status(200).json({ 
        success: true,
        connected: true,
        message: 'WhatsApp já está conectado'
      });
    }
    
    // Se chegou aqui, não conseguiu identificar um QR code na resposta
    console.log('Resposta não contém QR code reconhecível');
    return res.status(400).json({ 
      error: 'Não foi possível obter QR code válido',
      details: response.data
    });
    
  } catch (error) {
    console.error('Erro ao obter QR code:', error.message);
    return res.status(500).json({ 
      error: 'Erro ao tentar conectar com a API WhatsApp',
      message: error.message
    });
  }
}

/**
 * Conecta ao WhatsApp via Cloud API
 */
export async function connectWhatsAppCloud(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { phoneNumber, businessId } = req.body;
    
    if (!phoneNumber || !businessId) {
      return res.status(400).json({ 
        error: 'Número de telefone e Business ID são obrigatórios'
      });
    }

    // Buscar servidor do usuário
    const userId = req.user?.id;
    const server = await fetchUserServer(userId);
    
    if (!server) {
      return res.status(404).json({ error: "Servidor não encontrado" });
    }

    // Dados necessários para a conexão
    const { apiUrl, apiToken, instanceId } = server;
    const baseUrl = apiUrl.replace(/\/+$/, '');
    const token = apiToken || process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN;
    const instance = instanceId || req.user?.username || 'admin';
    
    console.log(`Tentando conexão Cloud API:
      URL: ${baseUrl}
      Instância: ${instance}
      Token: ${token ? token.substring(0, 5) + '...' + token.substring(token.length - 5) : 'não definido'}
      Telefone: ${phoneNumber}
      Business ID: ${businessId}
    `);
    
    // 1. Excluir instância existente se houver
    try {
      console.log(`Verificando se a instância ${instance} existe...`);
      await axios.delete(`${baseUrl}/instance/delete/${instance}`, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': token
        }
      });
      console.log(`Instância ${instance} excluída com sucesso ou não existia`);
    } catch (deleteError) {
      console.log(`Erro ao excluir instância (possivelmente não existia): ${deleteError.message}`);
    }
    
    // 2. Criar uma nova instância em modo Cloud API
    const createEndpoint = `${baseUrl}/instance/create`;
    console.log(`Criando instância em modo Cloud API: ${createEndpoint}`);
    
    try {
      const createData = {
        instanceName: instance,
        token: token,
        webhook: null,
        webhookByEvents: false,
        integration: "WHATSAPP-CLOUD-API", // Modo Cloud API
        language: "pt-BR",
        phoneNumber: phoneNumber,
        businessId: businessId
      };
      
      const createResponse = await axios.post(createEndpoint, createData, { 
        headers: {
          'Content-Type': 'application/json',
          'apikey': token
        }
      });
      
      console.log('Instância Cloud API criada com sucesso:', JSON.stringify(createResponse.data).substring(0, 300) + '...');
      
      // Retornar sucesso
      return res.status(200).json({ 
        success: true,
        connected: true,
        phoneNumber,
        businessId,
        message: 'WhatsApp Cloud API conectado com sucesso'
      });
    } catch (createError) {
      console.error('Erro ao criar instância Cloud API:', createError.message);
      return res.status(500).json({ 
        error: 'Erro ao criar instância Cloud API',
        message: createError.message
      });
    }
    
  } catch (error) {
    console.error('Erro ao conectar WhatsApp Cloud:', error.message);
    return res.status(500).json({ 
      error: 'Erro ao tentar conectar com a API WhatsApp Cloud',
      message: error.message
    });
  }
}

/**
 * Verifica o status da conexão WhatsApp
 */
export async function checkConnectionStatus(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    // Buscar servidor do usuário
    const userId = req.user?.id;
    const server = await fetchUserServer(userId);
    
    if (!server) {
      return res.status(404).json({ error: "Servidor não encontrado" });
    }

    // Dados necessários para a conexão
    const { apiUrl, apiToken, instanceId } = server;
    const baseUrl = apiUrl.replace(/\/+$/, '');
    const token = apiToken || process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN;
    const instance = instanceId || req.user?.username || 'admin';
    
    console.log(`Verificando status da conexão:
      URL: ${baseUrl}
      Instância: ${instance}
    `);

    // Headers para autenticação
    const headers = {
      'Content-Type': 'application/json',
      'apikey': token,
      'Authorization': `Bearer ${token}`
    };

    // Verificar status da conexão
    const statusEndpoint = `${baseUrl}/instance/connectionState/${instance}`;
    
    try {
      const response = await axios.get(statusEndpoint, { headers });
      
      console.log(`Status da conexão:`, JSON.stringify(response.data));
      
      const isConnected = 
        response.data?.state === 'open' || 
        response.data?.state === 'connected' ||
        response.data?.connected === true;
      
      return res.status(200).json({
        connected: isConnected,
        state: response.data?.state,
        phoneNumber: response.data?.phoneNumber || null,
        businessId: response.data?.businessId || null,
        cloudConnection: response.data?.integration === 'WHATSAPP-CLOUD-API'
      });
    } catch (statusError) {
      console.log('Erro ao verificar status:', statusError.message);
      
      // Se a instância não existe, considerar como desconectado
      return res.status(200).json({
        connected: false,
        state: 'disconnected',
        error: statusError.message
      });
    }
    
  } catch (error) {
    console.error('Erro ao verificar status da conexão:', error.message);
    return res.status(500).json({ 
      error: 'Erro ao verificar status da conexão',
      message: error.message
    });
  }
}

/**
 * Desconecta o WhatsApp
 */
export async function disconnectWhatsApp(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    // Buscar servidor do usuário
    const userId = req.user?.id;
    const server = await fetchUserServer(userId);
    
    if (!server) {
      return res.status(404).json({ error: "Servidor não encontrado" });
    }

    // Dados necessários para a desconexão
    const { apiUrl, apiToken, instanceId } = server;
    const baseUrl = apiUrl.replace(/\/+$/, '');
    const token = apiToken || process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN;
    const instance = instanceId || req.user?.username || 'admin';
    
    console.log(`Desconectando WhatsApp:
      URL: ${baseUrl}
      Instância: ${instance}
    `);

    // Headers para autenticação
    const headers = {
      'Content-Type': 'application/json',
      'apikey': token,
      'Authorization': `Bearer ${token}`
    };

    // Desconectar WhatsApp
    const logoutEndpoint = `${baseUrl}/instance/logout/${instance}`;
    
    try {
      await axios.delete(logoutEndpoint, { headers });
      
      console.log('WhatsApp desconectado com sucesso');
      
      return res.status(200).json({
        success: true,
        message: 'WhatsApp desconectado com sucesso'
      });
    } catch (logoutError) {
      console.log('Erro ao desconectar:', logoutError.message);
      
      // Tentar também deletar a instância
      try {
        const deleteEndpoint = `${baseUrl}/instance/delete/${instance}`;
        await axios.delete(deleteEndpoint, { headers });
        
        console.log('Instância excluída com sucesso');
        
        return res.status(200).json({
          success: true,
          message: 'Instância excluída com sucesso'
        });
      } catch (deleteError) {
        return res.status(500).json({ 
          error: 'Erro ao desconectar WhatsApp',
          message: logoutError.message
        });
      }
    }
    
  } catch (error) {
    console.error('Erro ao desconectar WhatsApp:', error.message);
    return res.status(500).json({ 
      error: 'Erro ao desconectar WhatsApp',
      message: error.message
    });
  }
}

/**
 * Obtém os dados do servidor do usuário
 */
async function fetchUserServer(userId: number) {
  try {
    // Buscar todos os servidores do usuário
    const userServers = await storage.getUserServers(userId);
    
    // Se não houver nenhum servidor, retorna erro
    if (!userServers || userServers.length === 0) {
      console.log(`Nenhum servidor encontrado para o usuário ${userId}`);
      return null;
    }
    
    // Encontrar servidor ativo
    const activeServer = userServers.find(us => us.server?.active === true);
    
    // Se houver um servidor ativo, retorná-lo
    if (activeServer?.server) {
      return {
        apiUrl: activeServer.server.apiUrl,
        apiToken: activeServer.server.apiToken,
        instanceId: activeServer.server.instanceId
      };
    }
    
    // Se não houver servidor ativo, pegar o primeiro da lista
    if (userServers[0]?.server) {
      return {
        apiUrl: userServers[0].server.apiUrl,
        apiToken: userServers[0].server.apiToken,
        instanceId: userServers[0].server.instanceId
      };
    }
    
    console.log(`Nenhum servidor válido encontrado para o usuário ${userId}`);
    return null;
  } catch (error) {
    console.error(`Erro ao buscar servidor do usuário ${userId}:`, error);
    return null;
  }
}