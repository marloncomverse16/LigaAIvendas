/**
 * Módulo simplificado para conexão com a Evolution API
 * Baseado nos testes que mostraram o endpoint correto funcionando
 */

import axios from 'axios';
import { Request, Response } from 'express';
import { storage } from './storage';

// Constantes - valores conhecidos que funcionam
const DEFAULT_TOKEN = '4db623449606bcf2814521b73657dbc0';

/**
 * Função otimizada para obter QR code da Evolution API
 * Usando apenas o endpoint que sabemos que funciona
 */
export async function getWhatsAppQrCode(req: Request, res: Response) {
  try {
    console.log('Obtendo QR code pelo método otimizado (apenas GET)');
    
    // Obter dados do usuário
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Buscar servidor do usuário
    const server = await fetchUserServer(userId);
    if (!server) {
      return res.status(404).json({ error: 'Servidor não encontrado' });
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
      const createEndpoint = `${baseUrl}/instance/create`;
      console.log(`Criando instância primeiro (se não existir): ${createEndpoint}`);
      
      const createData = {
        instanceName: instance,
        token: token,
        webhook: null,
        webhookByEvents: false,
        integration: "WHATSAPP-BAILEYS", 
        language: "pt-BR"
      };
      
      await axios.post(createEndpoint, createData, { 
        headers: {
          'Content-Type': 'application/json',
          'apikey': token
        }
      });
      
      console.log('Instância criada com sucesso ou já existente');
    } catch (createError) {
      // Ignorar erros de criação (instância pode já existir)
      console.log('Criação de instância retornou erro (pode ser normal se já existir):', createError.message);
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
 * Obtém os dados do servidor do usuário
 * Adicionada lógica para usar um servidor padrão quando o usuário não tem servidor associado
 */
async function fetchUserServer(userId: number) {
  try {
    // Buscar todos os servidores do usuário
    const userServers = await storage.getUserServers(userId);
    
    // Encontrar servidor ativo entre os servidores do usuário
    if (userServers && userServers.length > 0) {
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
    }
    
    // Se não encontrou servidor do usuário, buscar um servidor padrão ativo
    console.log(`Nenhum servidor encontrado para o usuário ${userId}. Buscando um servidor padrão ativo...`);
    
    try {
      const defaultServers = await storage.getActiveServers();
      
      if (defaultServers && defaultServers.length > 0) {
        console.log(`Usando servidor padrão: ${defaultServers[0].name}`);
        return {
          apiUrl: defaultServers[0].apiUrl,
          apiToken: defaultServers[0].apiToken,
          instanceId: null // Será substituído pelo username do usuário
        };
      }
    } catch (defaultServerError) {
      console.error("Erro ao buscar servidor padrão:", defaultServerError);
    }
    
    // Se ainda não encontrou, usar valores hardcoded como último recurso
    console.log(`Nenhum servidor encontrado no banco de dados. Usando valores padrão.`);
    return {
      apiUrl: "https://api.primerastreadores.com",
      apiToken: process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN,
      instanceId: null // Será substituído pelo username do usuário
    };
  } catch (error) {
    console.error(`Erro ao buscar servidor do usuário ${userId}:`, error);
    
    // Mesmo com erro, retorna um servidor padrão como fallback
    return {
      apiUrl: "https://api.primerastreadores.com",
      apiToken: process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN,
      instanceId: null // Será substituído pelo username do usuário
    };
  }
}