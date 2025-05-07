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
 * 
 * Verificações implementadas:
 * 1. Verifica se a instância existe, se não, cria
 * 2. Se existir, tenta deletar e recriar
 * 3. Depois conecta e obtém o QR Code
 */
export async function getWhatsAppQrCode(req: Request, res: Response) {
  try {
    console.log('Obtendo QR code pelo método otimizado e melhorado');
    
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
    
    // Headers de autenticação (importante: 'apikey' é o formato correto para v2.2.3)
    const headers = {
      'Content-Type': 'application/json',
      'apikey': token
    };
    
    // 1. Verificar se a instância existe
    try {
      const checkEndpoint = `${baseUrl}/instance/connectionState/${instance}`;
      console.log(`Verificando se a instância ${instance} existe: ${checkEndpoint}`);
      
      const checkResponse = await axios.get(checkEndpoint, {
        headers,
        timeout: 10000
      });
      
      const instanceExists = checkResponse.status === 200 && 
                             (checkResponse.data?.state || 
                             checkResponse.data?.status === 'CONNECTED');
      
      console.log(`Status da instância: ${instanceExists ? 'Existe' : 'Não existe ou erro'}`);
      
      // 2. Se a instância existe, tentar deletá-la primeiro para garantir um QR code limpo
      if (instanceExists) {
        try {
          const deleteEndpoint = `${baseUrl}/instance/delete/${instance}`;
          console.log(`Deletando instância existente para garantir QR limpo: ${deleteEndpoint}`);
          
          await axios.delete(deleteEndpoint, { headers });
          console.log('Instância deletada com sucesso');
          
          // Aguardar um momento para garantir que a deleção seja processada
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (deleteError) {
          console.warn('Não foi possível deletar a instância:', deleteError?.message);
          // Continuar mesmo com erro na deleção
        }
      }
    } catch (checkError) {
      console.log('Erro ao verificar instância (continuando com criação):', checkError?.message);
      // Continuar mesmo com erro na verificação - vamos tentar criar
    }
    
    // 3. Criar a instância (mesmo se já existir, para garantir configurações corretas)
    try {
      const createEndpoint = `${baseUrl}/instance/create`;
      console.log(`Criando instância: ${createEndpoint}`);
      
      const createData = {
        instanceName: instance,
        token: token,
        webhook: null,
        webhookByEvents: false,
        integration: "WHATSAPP-BAILEYS", 
        language: "pt-BR"
      };
      
      const createResponse = await axios.post(createEndpoint, createData, { headers });
      console.log('Resposta da criação de instância:', JSON.stringify(createResponse.data));
      
      // Aguardar um momento para garantir que a criação seja processada
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (createError) {
      console.warn('Erro ao criar instância (pode ser normal se já existir):', createError?.message);
      // Continuar mesmo com erro na criação - vamos tentar conectar
    }

    // 4. Conectar e obter QR code
    const endpoint = `${baseUrl}/instance/connect/${instance}`;
    console.log(`Obtendo QR code: ${endpoint}`);
    
    const response = await axios.get(endpoint, { 
      headers, 
      timeout: 15000 
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
 * Utiliza a URL configurada no servidor do usuário
 */
async function fetchUserServer(userId: number) {
  try {
    console.log(`Buscando servidor para o usuário ${userId}...`);
    
    // Buscar todos os servidores do usuário através da relação server_users
    const userServerRelations = await storage.getUserServerRelationsByUserId(userId);
    console.log(`Encontradas ${userServerRelations?.length || 0} relações de servidor para o usuário ${userId}`);
    
    if (userServerRelations && userServerRelations.length > 0) {
      // Primeiro tentar o servidor default do usuário
      const defaultRelation = userServerRelations.find(r => r.isDefault === true);
      
      if (defaultRelation) {
        const server = await storage.getServerById(defaultRelation.serverId);
        if (server && server.active) {
          console.log(`Usando servidor padrão do usuário: ${server.name}, URL: ${server.apiUrl}`);
          return {
            apiUrl: server.apiUrl,
            apiToken: server.apiToken || process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN,
            instanceId: null // Será substituído pelo username do usuário
          };
        }
      }
      
      // Se não encontrou servidor padrão, tentar o primeiro servidor ativo
      for (const relation of userServerRelations) {
        const server = await storage.getServerById(relation.serverId);
        if (server && server.active) {
          console.log(`Usando servidor ativo encontrado: ${server.name}, URL: ${server.apiUrl}`);
          return {
            apiUrl: server.apiUrl,
            apiToken: server.apiToken || process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN,
            instanceId: null
          };
        }
      }
    }
    
    // Se não encontrou servidor do usuário, buscar um servidor padrão ativo
    console.log(`Nenhum servidor encontrado para o usuário ${userId}. Buscando servidores ativos...`);
    
    const activeServers = await storage.getActiveServers();
    if (activeServers && activeServers.length > 0) {
      console.log(`Usando servidor ativo do sistema: ${activeServers[0].name}, URL: ${activeServers[0].apiUrl}`);
      return {
        apiUrl: activeServers[0].apiUrl,
        apiToken: activeServers[0].apiToken || process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN,
        instanceId: null
      };
    }
    
    // Se ainda não encontrou, usar valores hardcoded como último recurso
    console.log(`Nenhum servidor ativo encontrado. Usando valores padrão.`);
    return {
      apiUrl: "https://api.primerastreadores.com",
      apiToken: process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN,
      instanceId: null
    };
  } catch (error) {
    console.error(`Erro ao buscar servidor do usuário ${userId}:`, error);
    
    // Mesmo com erro, retorna um servidor padrão como fallback
    return {
      apiUrl: "https://api.primerastreadores.com",
      apiToken: process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN,
      instanceId: null
    };
  }
}