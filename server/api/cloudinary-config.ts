/**
 * Configuração do Cloudinary para armazenamento e gerenciamento de mídia
 * Essa solução resolve definitivamente o problema de CORS e compatibilidade de mídias
 */

import { v2 as cloudinary } from 'cloudinary';
import { Request } from 'express';
import * as path from 'path';

// Configuração do Cloudinary com variáveis de ambiente
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cache para evitar uploads duplicados e melhorar a performance
const mediaCache = new Map<string, string>();

/**
 * Obtém a extensão de arquivo com base no tipo MIME
 */
function getFileExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/opus': '.opus'
  };
  
  return mimeToExt[mimeType] || '.bin';
}

/**
 * Determina o tipo de recurso (resource_type) para o Cloudinary com base no MIME type
 */
function getResourceType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'video'; // Cloudinary armazena áudio como vídeo
  return 'auto';
}

/**
 * Gera um ID público único para o arquivo no Cloudinary
 */
function generatePublicId(originalUrl: string): string {
  // Criar um ID baseado na URL original, mas sanitizado
  const urlHash = Buffer.from(originalUrl).toString('base64')
    .replace(/[\/\+\=]/g, '_')
    .substring(0, 20);
  
  return `whatsapp_media/${Date.now()}_${urlHash}`;
}

export {
  cloudinary,
  mediaCache,
  getFileExtensionFromMimeType,
  getResourceType,
  generatePublicId
};