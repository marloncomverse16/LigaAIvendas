/**
 * Proxy simplificado e otimizado para mídias do WhatsApp
 * Esta é uma implementação completa que resolve os problemas de
 * visualização de imagens, áudios e vídeos do WhatsApp
 */
import { Request, Response } from 'express';
import axios from 'axios';

/**
 * Serviço de proxy para mídias do WhatsApp
 * Suporta todos os tipos de mídias: imagens, vídeos, áudios e documentos
 */
export async function serveMedia(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  const { url, type, mimetype } = req.query;

  if (!url) {
    return res.status(400).json({ message: "URL da mídia não fornecida" });
  }

  console.log(`[Media Proxy] Processando mídia: ${url} (tipo: ${type || 'desconhecido'})`);

  try {
    // Configuração da requisição com as opções corretas
    const config: any = {
      method: 'get',
      url: url as string,
      responseType: 'arraybuffer',
      timeout: 20000, // 20s de timeout para arquivos maiores
      headers: {
        'Accept': '*/*',
        'User-Agent': 'WhatsAppMediaProxy/1.0'
      }
    };

    // Adicionar token de autenticação para URLs da Evolution API
    if (url.toString().includes('api.primerastreadores.com')) {
      console.log('[Media Proxy] Detectada URL da Evolution API, adicionando token');
      config.headers['Authorization'] = 'Bearer 4db623449606bcf2814521b73657dbc0';
      config.headers['apikey'] = '4db623449606bcf2814521b73657dbc0';
    }

    // Fazer a requisição para obter o conteúdo da mídia
    const mediaResponse = await axios(config);
    
    // Determinar o tipo de conteúdo correto
    let contentType;
    
    // Prioridade:
    // 1. Usar mimetype explícito da query se fornecido
    // 2. Usar o Content-Type da resposta se disponível
    // 3. Inferir pelo parâmetro 'type'
    // 4. Usar octect-stream como fallback
    
    if (mimetype && mimetype !== 'false' && typeof mimetype === 'string') {
      contentType = mimetype;
    } else if (mediaResponse.headers['content-type'] && 
               mediaResponse.headers['content-type'] !== 'application/octet-stream') {
      contentType = mediaResponse.headers['content-type'];
    } else {
      // Inferir pelo tipo de mídia
      switch (type) {
        case 'image':
          contentType = 'image/jpeg';
          break;
        case 'video':
          contentType = 'video/mp4';
          break;
        case 'audio':
        case 'ptt':
          // Para áudios do WhatsApp (PTT = Push To Talk)
          if (url.toString().includes('.enc')) {
            contentType = 'audio/ogg; codecs=opus';
          } else {
            contentType = 'audio/mpeg';
          }
          break;
        case 'document':
          contentType = 'application/pdf';
          break;
        default:
          contentType = 'application/octet-stream';
      }
    }

    // Configurar headers de resposta adequados
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', mediaResponse.data.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 24 horas
    
    // Se for áudio ogg, adicionar os headers necessários para reproducão
    if (contentType.includes('audio/ogg')) {
      res.setHeader('Accept-Ranges', 'bytes');
    }
    
    // Enviar o buffer diretamente, sem manipulação
    return res.send(mediaResponse.data);
    
  } catch (error) {
    console.error('[Media Proxy] Erro ao processar mídia:', error);
    
    // Resposta de erro detalhada
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar mídia',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      url: url
    });
  }
}