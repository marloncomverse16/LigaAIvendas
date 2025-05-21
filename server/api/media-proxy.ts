/**
 * Módulo para proxy de arquivos de mídia do WhatsApp
 * Resolve o problema de arquivos .enc baixados do WhatsApp
 */
import { Request, Response } from 'express';
import axios from 'axios';
import { storage } from '../storage';

/**
 * Controlador que faz proxy para arquivos de mídia do WhatsApp
 * Permite visualização direta no navegador em vez de download de arquivos .enc
 */
export async function proxyMedia(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  const url = req.query.url as string;
  const type = req.query.type as string;
  const mimetype = req.query.mimetype as string;
  
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

    console.log(`Fazendo proxy para mídia: ${url}`);
    
    // Configura o tipo de conteúdo baseado no parâmetro 'type'
    let contentType = 'application/octet-stream'; // Padrão
    
    if (type === 'image') {
      contentType = mimetype && mimetype !== 'false' ? mimetype : 'image/jpeg';
    } else if (type === 'video') {
      contentType = mimetype && mimetype !== 'false' ? mimetype : 'video/mp4';
    } else if (type === 'audio') {
      contentType = mimetype && mimetype !== 'false' ? mimetype : 'audio/ogg';
    } else if (type === 'document') {
      contentType = mimetype && mimetype !== 'false' ? mimetype : 'application/pdf';
    }
    
    // Nome do arquivo para download
    let fileName = `${type || 'media'}_${Date.now()}`;
    if (type === 'image') fileName += '.jpg';
    else if (type === 'video') fileName += '.mp4';
    else if (type === 'audio') fileName += '.ogg';
    else if (type === 'document') fileName += '.pdf';

    console.log(`Enviando requisição para URL: ${url}`);
    console.log(`Tipo de conteúdo: ${contentType}`);
    
    // Fazer requisição para a URL da mídia com o token de autenticação
    const mediaResponse = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${server.apiToken}`,
        'apikey': server.apiToken
      },
      // Timeout mais longo para arquivos grandes
      timeout: 30000 
    });
    
    // Verificar se recebemos uma resposta válida
    if (mediaResponse.status !== 200) {
      throw new Error(`Falha ao recuperar mídia: ${mediaResponse.status}`);
    }
    
    // Define os cabeçalhos para a resposta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    
    // Envia os dados do arquivo
    return res.send(mediaResponse.data);
    
  } catch (error) {
    console.error('Erro ao fazer proxy para mídia:', error);
    
    // Se tiver resposta do servidor, enviar os detalhes
    if (error.response) {
      return res.status(error.response.status).json({
        message: 'Erro ao obter mídia',
        status: error.response.status,
        statusText: error.response.statusText
      });
    }
    
    // Erro genérico
    return res.status(500).json({
      message: 'Erro ao obter mídia',
      error: error.message || 'Erro desconhecido'
    });
  }
}