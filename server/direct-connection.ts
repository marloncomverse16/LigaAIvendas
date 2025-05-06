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

    // Headers de autenticação (importante: 'apikey' é o formato correto para v2.2.3)
    const headers = {
      'Content-Type': 'application/json',
      'apikey': token,
      'Authorization': `Bearer ${token}`
    };

    // Endpoint específico que foi validado em testes
    const endpoint = `${baseUrl}/instance/connect/${instance}`;
    console.log(`Fazendo requisição GET para: ${endpoint}`);
    
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
    
    // Extrair QR code da resposta
    const qrCode = response.data?.qrcode || 
                   response.data?.qrCode || 
                   response.data?.base64 || 
                   response.data?.code ||
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