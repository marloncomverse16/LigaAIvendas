/**
 * Proxy simplificado para mídia do WhatsApp
 * Implementação otimizada para áudios e imagens
 */
import { Request, Response } from 'express';
import axios from 'axios';
import { storage } from '../storage';
import https from 'https';

/**
 * Middleware para servir mídia diretamente com headers corretos
 * Implementação simplificada que apenas repassa o conteúdo
 * Sem processamento adicional para garantir compatibilidade
 */
export async function directMediaProxy(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  const url = req.query.url as string;
  
  if (!url) {
    return res.status(400).json({ message: "URL não fornecida" });
  }

  const userId = req.user.id;
  
  try {
    // Obter o servidor do usuário para pegar o token de autenticação
    const userServers = await storage.getUserServers(userId);
    
    if (!userServers || userServers.length === 0 || !userServers[0].server) {
      return res.status(404).json({ message: "Servidor não configurado" });
    }
    
    const server = userServers[0].server;
    
    if (!server.apiToken) {
      return res.status(404).json({ message: "Token de API não configurado" });
    }

    console.log(`[Media Proxy] Fazendo proxy para: ${url}`);
    
    // Criar instância do Axios com configuração para ignorar erros SSL
    const instance = axios.create({
      httpsAgent: new https.Agent({  
        rejectUnauthorized: false // Ignorar erros de certificado SSL
      }),
      timeout: 30000 // Timeout de 30 segundos
    });
    
    // Fazer requisição para a URL da mídia com o token de autenticação
    const mediaResponse = await instance({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${server.apiToken}`,
        'apikey': server.apiToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Cache-Control': 'no-cache'
      }
    });

    // Detectar tipo de conteúdo
    let contentType = mediaResponse.headers['content-type'];
    
    if (!contentType || contentType === 'application/octet-stream') {
      // Tentar inferir o tipo baseado na URL
      if (url.includes('.jpeg') || url.includes('.jpg')) {
        contentType = 'image/jpeg';
      } else if (url.includes('.png')) {
        contentType = 'image/png';
      } else if (url.includes('.webp')) {
        contentType = 'image/webp';
      } else if (url.includes('.mp4')) {
        contentType = 'video/mp4';
      } else if (url.includes('.mp3')) {
        contentType = 'audio/mpeg';
      } else if (url.includes('.ogg') || url.includes('.opus')) {
        contentType = 'audio/ogg';
      } else if (url.includes('.pdf')) {
        contentType = 'application/pdf';
      } else if (url.includes('.enc')) {
        // Para arquivos .enc, verificar o que está sendo requisitado
        if (req.path.includes('audio')) {
          contentType = 'audio/mpeg';
        } else {
          contentType = 'application/octet-stream';
        }
      } else {
        contentType = 'application/octet-stream';
      }
    }

    // Definir cabeçalhos para a resposta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', mediaResponse.data.length);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache de 1 dia
    
    // Enviar os dados
    return res.send(mediaResponse.data);
    
  } catch (error) {
    console.error('Erro ao fazer proxy de mídia:', error);
    return res.status(500).json({
      message: 'Erro ao acessar mídia',
      error: error.message
    });
  }
}

/**
 * Proxy otimizado para áudios do WhatsApp
 * Os áudios do WhatsApp necessitam de um tratamento especial
 */
export async function audioProxy(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  const url = req.query.url as string;
  
  if (!url) {
    return res.status(400).json({ message: "URL não fornecida" });
  }

  const userId = req.user.id;
  
  try {
    // Obter o servidor do usuário para pegar o token de autenticação
    const userServers = await storage.getUserServers(userId);
    
    if (!userServers || userServers.length === 0 || !userServers[0].server) {
      return res.status(404).json({ message: "Servidor não configurado" });
    }
    
    const server = userServers[0].server;
    
    if (!server.apiToken) {
      return res.status(404).json({ message: "Token de API não configurado" });
    }

    console.log(`[Audio Proxy] Processando áudio: ${url}`);
    
    // Criar instância do Axios com configuração para ignorar erros SSL
    const instance = axios.create({
      httpsAgent: new https.Agent({  
        rejectUnauthorized: false // Ignorar erros de certificado SSL
      }),
      timeout: 30000 // Timeout de 30 segundos
    });
    
    // Fazer requisição para a URL do áudio com o token de autenticação
    const mediaResponse = await instance({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${server.apiToken}`,
        'apikey': server.apiToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Cache-Control': 'no-cache'
      }
    });

    // Para áudios, sempre definir o tipo como audio/mpeg para maior compatibilidade
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', mediaResponse.data.length);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache de 1 dia
    
    // Enviar os dados originais sem processamento
    return res.send(mediaResponse.data);
    
  } catch (error) {
    console.error('Erro ao processar áudio:', error);
    return res.status(500).json({
      message: 'Erro ao acessar áudio',
      error: error.message
    });
  }
}