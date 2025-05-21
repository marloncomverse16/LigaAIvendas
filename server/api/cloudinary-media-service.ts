/**
 * Serviço de processamento de mídia usando Cloudinary
 * Resolve definitivamente o problema de CORS e compatibilidade com navegadores
 */

import { Request, Response } from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  cloudinary, 
  mediaCache, 
  getFileExtensionFromMimeType, 
  getResourceType,
  generatePublicId
} from './cloudinary-config';

/**
 * Processa uma URL de mídia da Evolution API e retorna a URL do Cloudinary
 */
async function processMediaUrl(mediaUrl: string, mimeType?: string): Promise<string> {
  // Verificar se já temos esta URL no cache
  if (mediaCache.has(mediaUrl)) {
    console.log(`[Cloudinary] Usando cache para URL: ${mediaUrl.substring(0, 50)}...`);
    return mediaCache.get(mediaUrl) as string;
  }

  try {
    // Headers para Download
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br'
    };

    // Se for URL da Evolution API, adicionar token
    if (mediaUrl.includes('api.primerastreadores.com')) {
      headers['Authorization'] = `Bearer 4db623449606bcf2814521b73657dbc0`;
      headers['apikey'] = `4db623449606bcf2814521b73657dbc0`;
    }

    console.log(`[Cloudinary] Baixando mídia: ${mediaUrl.substring(0, 100)}...`);
    
    // Fazer download da mídia
    const response = await axios({
      method: 'get',
      url: mediaUrl,
      responseType: 'arraybuffer',
      headers,
      maxRedirects: 5,
      timeout: 30000
    });

    // Determinar o tipo de mídia se não foi fornecido
    const contentType = mimeType || response.headers['content-type'] || 'application/octet-stream';
    const fileExt = getFileExtensionFromMimeType(contentType);
    const resourceType = getResourceType(contentType);
    
    // Criar um nome de arquivo temporário único
    const tempFilePath = path.join(os.tmpdir(), `whatsapp-media-${Date.now()}${fileExt}`);
    
    // Salvar os dados em um arquivo temporário
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));

    // Determinar tipo de mídia especial para áudios do WhatsApp
    let finalResourceType = resourceType;
    let finalMimeType = contentType;
    
    if (mediaUrl.includes('.enc') && mediaUrl.includes('/t62.7117-24/')) {
      finalResourceType = 'video'; // Cloudinary usa "video" para áudio também
      finalMimeType = 'audio/ogg'; // WhatsApp usa Opus em contêiner Ogg
    }

    console.log(`[Cloudinary] Fazendo upload para Cloudinary (tipo: ${finalResourceType}, mime: ${finalMimeType})`);
    
    // Fazer upload para o Cloudinary
    const result = await cloudinary.uploader.upload(tempFilePath, {
      resource_type: finalResourceType as any,
      folder: 'whatsapp_media',
      public_id: generatePublicId(mediaUrl),
      format: fileExt.replace('.', ''),
      overwrite: true
    });

    // Remover o arquivo temporário
    fs.unlinkSync(tempFilePath);

    console.log(`[Cloudinary] Upload bem-sucedido: ${result.secure_url}`);
    
    // Armazenar no cache para futuros acessos
    mediaCache.set(mediaUrl, result.secure_url);
    
    return result.secure_url;
  } catch (error) {
    console.error('[Cloudinary] Erro ao processar mídia:', error);
    // Se o erro for relacionado ao Cloudinary, tentar servir a mídia diretamente
    throw error;
  }
}

/**
 * Rota para processar mídia da Evolution API e retornar URL do Cloudinary
 */
export async function processMediaProxy(req: Request, res: Response) {
  try {
    // Verificações básicas
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const { url, mimetype } = req.query;

    if (!url) {
      return res.status(400).json({ message: "URL da mídia não fornecida" });
    }

    // Processar a URL da mídia e obter a URL do Cloudinary
    const cloudinaryUrl = await processMediaUrl(url.toString(), mimetype?.toString());
    
    // Retornar a URL do Cloudinary
    return res.json({ 
      success: true, 
      url: cloudinaryUrl,
      originalUrl: url.toString()
    });
  } catch (error) {
    console.error('[Cloudinary] Erro ao processar mídia:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Erro ao processar mídia',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}