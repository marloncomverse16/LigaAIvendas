/**
 * Proxy especializado para mídia do WhatsApp
 * Lida com arquivos criptografados (.enc) e diferentes tipos de mídia
 */
import { Request, Response } from 'express';
import axios from 'axios';

export async function whatsappMediaProxy(req: Request, res: Response) {
  try {
    const { url, messageKey, mediaKey, type } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL da mídia é obrigatória' });
    }

    const mediaUrl = decodeURIComponent(url as string);
    console.log(`[WhatsApp Media Proxy] Processando mídia: ${mediaUrl}`);

    // Verificar se é um arquivo criptografado (.enc)
    const isEncrypted = mediaUrl.includes('.enc');
    
    if (isEncrypted) {
      console.log(`[WhatsApp Media Proxy] Arquivo criptografado detectado`);
      
      // Para arquivos criptografados, tenta usar a Evolution API para descriptografar
      if (messageKey && mediaKey) {
        try {
          const evolutionResponse = await axios.get(`https://api.primerastreadores.com/chat/getBase64FromMediaMessage/admin`, {
            headers: {
              'Authorization': 'Bearer 4db623449606bcf2814521b73657dbc0',
              'Content-Type': 'application/json'
            },
            params: {
              message: {
                key: JSON.parse(messageKey as string),
                mediaKey: mediaKey as string,
                url: mediaUrl
              }
            },
            timeout: 10000
          });

          if (evolutionResponse.data && evolutionResponse.data.base64) {
            const buffer = Buffer.from(evolutionResponse.data.base64, 'base64');
            const mimeType = determineMimeType(mediaUrl, type as string);
            
            res.set({
              'Content-Type': mimeType,
              'Content-Length': buffer.length.toString(),
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*'
            });
            
            return res.send(buffer);
          }
        } catch (evolutionError) {
          console.log(`[WhatsApp Media Proxy] Falha na descriptografia via Evolution API:`, evolutionError.message);
        }
      }
    }

    // Fallback: tentar acesso direto à URL
    console.log(`[WhatsApp Media Proxy] Tentando acesso direto à mídia`);
    
    const response = await axios.get(mediaUrl, {
      responseType: 'stream',
      timeout: 15000,
      headers: {
        'User-Agent': 'WhatsApp/2.2.24.6 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    // Determinar o tipo MIME correto
    const mimeType = response.headers['content-type'] || determineMimeType(mediaUrl, type as string);
    
    // Configurar headers de resposta
    res.set({
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Content-Length': response.headers['content-length'] || undefined
    });

    // Fazer pipe da resposta
    response.data.pipe(res);
    
    console.log(`[WhatsApp Media Proxy] Mídia servida com sucesso (${mimeType})`);

  } catch (error) {
    console.error('[WhatsApp Media Proxy] Erro ao fazer proxy da mídia:', error);
    
    // Retornar uma resposta de erro mais informativa
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        error: 'Mídia não encontrada',
        message: 'O arquivo pode ter expirado ou não estar mais disponível'
      });
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: 'Servidor de mídia indisponível',
        message: 'Não foi possível conectar ao servidor do WhatsApp'
      });
    }
    
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Falha ao processar a mídia'
    });
  }
}

/**
 * Determina o tipo MIME baseado na URL e tipo fornecido
 */
function determineMimeType(url: string, type?: string): string {
  // Se o tipo foi fornecido explicitamente, usar ele
  if (type) {
    switch (type) {
      case 'audio':
      case 'audioMessage':
        return 'audio/ogg';
      case 'video':
      case 'videoMessage':
        return 'video/mp4';
      case 'image':
      case 'imageMessage':
        return 'image/jpeg';
      default:
        break;
    }
  }

  // Tentar determinar pelo URL
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('/t62.7117-24/') || urlLower.includes('audio')) {
    return 'audio/ogg';
  }
  
  if (urlLower.includes('/t24/f2/') || urlLower.includes('image') || urlLower.includes('jpg') || urlLower.includes('jpeg') || urlLower.includes('png')) {
    return 'image/jpeg';
  }
  
  if (urlLower.includes('video') || urlLower.includes('mp4')) {
    return 'video/mp4';
  }
  
  // Fallback padrão
  return 'application/octet-stream';
}