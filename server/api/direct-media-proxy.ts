/**
 * Proxy ultra-simplificado para mídias do WhatsApp
 * Implementação mínima com foco apenas em encaminhar os bytes brutos
 */
import { Request, Response } from 'express';
import axios from 'axios';

export async function proxyMedia(req: Request, res: Response) {
  try {
    // Verificações básicas
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const { url, mimetype } = req.query;

    if (!url) {
      return res.status(400).json({ message: "URL não fornecida" });
    }

    console.log(`[Direct Media Proxy] Processando mídia: ${url}`);

    // Configurar headers diretos para WhatsApp
    const requestOptions: any = {
      method: 'GET',
      url: url as string,
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      }
    };

    // Se for URL da Evolution API, adicionar token
    if (url.toString().includes('api.primerastreadores.com')) {
      requestOptions.headers['Authorization'] = 'Bearer 4db623449606bcf2814521b73657dbc0';
      requestOptions.headers['apikey'] = '4db623449606bcf2814521b73657dbc0';
    }

    // Tentar obter o conteúdo da mídia
    const mediaResponse = await axios(requestOptions);

    // Determinar MIME type correto
    let contentType = mimetype as string || 
                      mediaResponse.headers['content-type'] || 
                      'application/octet-stream';

    // Verificar se é um arquivo de áudio do WhatsApp
    if (url.toString().includes('.enc') && url.toString().includes('/t62.7117-24/')) {
      contentType = 'audio/ogg';
      console.log('[Direct Media Proxy] Detectado áudio do WhatsApp');
    }

    // Configurar headers de resposta
    res.set({
      'Content-Type': contentType,
      'Content-Length': mediaResponse.data.length,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=31536000', // Cache por 1 ano
      'Accept-Ranges': 'bytes'
    });

    // Enviar dados diretamente
    return res.send(mediaResponse.data);
  } catch (error) {
    console.error('[Direct Media Proxy] Erro:', error);
    
    return res.status(500).json({ 
      success: false,
      message: 'Erro ao processar mídia',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}