/**
 * Proxy direto para mídia do WhatsApp (imagens, vídeos, áudios, documentos)
 * Este módulo contém duas funções principais:
 * 1. directMediaProxy: para qualquer tipo de mídia do WhatsApp
 * 2. whatsappAudioProxy: específico para áudios do WhatsApp (formato enc)
 */

import { Request, Response } from 'express';
import axios from 'axios';
import https from 'https';
import crypto from 'crypto';

// Configurar o agente HTTPS para aceitar certificados autoassinados
const agent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Proxy direto para mídia do WhatsApp
 * Este proxy funciona como um intermediário confiável entre o frontend e o WhatsApp
 * permitindo que arquivos sejam exibidos diretamente no navegador
 */
export async function directMediaProxy(req: Request, res: Response) {
  const mediaUrl = req.query.url as string;
  
  if (!mediaUrl) {
    return res.status(400).json({
      success: false,
      message: 'URL da mídia não fornecida'
    });
  }
  
  try {
    console.log(`[Media Proxy] Fazendo proxy para: ${mediaUrl}`);
    
    // Configurar headers para request da mídia
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive'
    };
    
    // Fazer requisição para URL da mídia
    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers,
      httpsAgent: agent,
      timeout: 15000 // 15 segundos
    });
    
    // Obter tipo de conteúdo da resposta original ou derivar da URL
    let contentType = response.headers['content-type'] || 'application/octet-stream';
    
    // Ajustar tipo de conteúdo para formatos comuns de mídia do WhatsApp
    if (mediaUrl.includes('.jpeg') || mediaUrl.includes('.jpg')) {
      contentType = 'image/jpeg';
    } else if (mediaUrl.includes('.png')) {
      contentType = 'image/png';
    } else if (mediaUrl.includes('.mp4')) {
      contentType = 'video/mp4';
    } else if (mediaUrl.includes('.pdf')) {
      contentType = 'application/pdf';
    } else if (mediaUrl.includes('.mp3')) {
      contentType = 'audio/mpeg';
    } else if (mediaUrl.includes('.ogg') || mediaUrl.includes('.opus')) {
      contentType = 'audio/ogg';
    }
    
    // Definir headers da resposta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', response.data.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 24h
    
    // Enviar os dados da mídia para o cliente
    return res.send(response.data);
  } catch (error) {
    console.error('[Media Proxy] Erro:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao fazer proxy para mídia',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Proxy especializado para áudios do WhatsApp
 * Gerencia os arquivos .enc que são áudios criptografados do WhatsApp
 */
export async function whatsappAudioProxy(req: Request, res: Response) {
  const audioUrl = req.query.url as string;
  
  if (!audioUrl) {
    return res.status(400).json({
      success: false,
      message: 'URL do áudio não fornecida'
    });
  }
  
  try {
    console.log(`[Audio Proxy] Processando áudio: ${audioUrl}`);
    
    // Configurar headers para request do áudio
    const headers: Record<string, string> = {
      'User-Agent': 'WhatsApp/2.23.25.76 A',
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive'
    };
    
    // Fazer requisição para URL do áudio
    const response = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      headers,
      httpsAgent: agent,
      timeout: 15000 // 15 segundos
    });
    
    // Configurar resposta como áudio
    res.setHeader('Content-Type', 'audio/mpeg'); // Usando formato mais compatível
    res.setHeader('Content-Length', response.data.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 24h
    
    // Criar identificador único para o arquivo de áudio baseado na URL
    const fileId = crypto.createHash('md5').update(audioUrl).digest('hex');
    res.setHeader('Content-Disposition', `inline; filename="${fileId}.mp3"`);
    
    // Enviar os dados do áudio para o cliente
    return res.send(response.data);
  } catch (error) {
    console.error('[Audio Proxy] Erro:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar áudio do WhatsApp',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}