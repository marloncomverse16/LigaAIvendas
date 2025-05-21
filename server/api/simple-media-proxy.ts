/**
 * Proxy simplificado para arquivos de mídia WhatsApp
 * Solução direta para resolver problemas de visualização de mídias
 * Suporta todos os tipos de mídia sem conversão, enviando os arquivos como binary
 */
import { Request, Response } from 'express';
import axios from 'axios';

/**
 * Handler para servir arquivos de mídia do WhatsApp
 * Faz proxy das requisições, resolvendo problemas de CORS e formato
 */
export async function serveMediaProxy(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  const { url, type } = req.query;

  if (!url) {
    return res.status(400).json({ message: "URL não fornecida" });
  }

  console.log(`[Media Proxy] Processando mídia: ${url}`);

  try {
    // Requisição direta para a URL da mídia com responseType arraybuffer
    const mediaResponse = await axios({
      method: 'get',
      url: url as string,
      responseType: 'arraybuffer',
      timeout: 15000, // 15s de timeout
      headers: {
        'Accept': '*/*',
        'User-Agent': 'WhatsAppMediaProxy/1.0'
      }
    });

    // Determinar o tipo de conteúdo com base no tipo de mídia
    let contentType = mediaResponse.headers['content-type'];

    if (!contentType || contentType === 'application/octet-stream') {
      // Se o servidor não retornar um tipo de conteúdo válido, inferir pelo tipo
      switch (type) {
        case 'image':
          contentType = 'image/jpeg';
          break;
        case 'video':
          contentType = 'video/mp4';
          break;
        case 'audio':
          contentType = 'audio/mpeg';
          break;
        case 'document':
          contentType = 'application/pdf';
          break;
        default:
          contentType = 'application/octet-stream';
      }
    }

    // Configurar headers de resposta para permitir visualização no navegador
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', mediaResponse.data.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache de 24 horas
    
    // Retornar o buffer diretamente, sem manipulação
    return res.send(Buffer.from(mediaResponse.data));
  } catch (error) {
    console.error('[Media Proxy] Erro ao processar mídia:', error);
    
    // Retornar erro no formato JSON
    return res.status(500).json({
      message: 'Erro ao processar mídia',
      error: error.message,
      url: url
    });
  }
}