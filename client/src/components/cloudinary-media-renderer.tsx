/**
 * Componente para renderização de mídias através do Cloudinary
 * Resolve definitivamente o problema de visualização de mídias da Evolution API
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Mic, Image, Video, File, Loader2 } from 'lucide-react';

// Tipo de mídia suportados
type MediaType = 'image' | 'video' | 'audio' | 'document' | 'unknown';

// Propriedades do componente
interface CloudinaryMediaRendererProps {
  mediaUrl: string;
  mediaType?: MediaType;
  mimeType?: string;
  caption?: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  showFileInfo?: boolean;
  autoPlay?: boolean;
}

// Cache local para URLs já processadas
const urlCache = new Map<string, string>();

/**
 * Componente para renderização de mídias utilizando o Cloudinary
 */
export const CloudinaryMediaRenderer: React.FC<CloudinaryMediaRendererProps> = ({
  mediaUrl,
  mediaType = 'unknown',
  mimeType,
  caption,
  className = '',
  width = '100%',
  height = 'auto',
  showFileInfo = false,
  autoPlay = false
}) => {
  const [cloudinaryUrl, setCloudinaryUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [finalMediaType, setFinalMediaType] = useState<MediaType>(mediaType);

  useEffect(() => {
    // Resetar estado ao mudar a URL
    if (!mediaUrl) {
      setCloudinaryUrl(null);
      setLoading(false);
      return;
    }

    // Verificar se a URL já está no cache
    if (urlCache.has(mediaUrl)) {
      setCloudinaryUrl(urlCache.get(mediaUrl) || null);
      setLoading(false);
      return;
    }

    // Função para determinar o tipo de mídia com base na URL ou MIME
    const detectMediaType = (url: string, mime?: string): MediaType => {
      // Se o tipo MIME foi fornecido, use-o para determinar o tipo
      if (mime) {
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('video/')) return 'video';
        if (mime.startsWith('audio/')) return 'audio';
        if (mime.includes('pdf') || mime.includes('document')) return 'document';
      }

      // Se tivermos um tipo definido externamente (e não for unknown), use-o
      if (mediaType !== 'unknown') return mediaType;
      
      // Caso especial: áudio do WhatsApp
      if (url.includes('.enc') && url.includes('/t62.7117-24/')) {
        return 'audio';
      }

      // Tentar determinar pelo nome do arquivo/URL
      const lowercaseUrl = url.toLowerCase();
      if (lowercaseUrl.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)(\?.*)?$/i)) return 'image';
      if (lowercaseUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) return 'video';
      if (lowercaseUrl.match(/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i)) return 'audio';
      if (lowercaseUrl.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)(\?.*)?$/i)) return 'document';

      // Caso não seja possível determinar
      return 'unknown';
    };

    // Processar a URL através do novo proxy direto
    const processMediaUrl = async () => {
      try {
        setLoading(true);
        
        // Detectar o tipo de mídia
        const detectedType = detectMediaType(mediaUrl, mimeType);
        setFinalMediaType(detectedType);

        // Criar URL do proxy adequado para o tipo de mídia
        let proxyUrl: string;
        
        // Para áudios do WhatsApp (.enc), usar o proxy especializado
        if (detectedType === 'audio' && mediaUrl.includes('.enc')) {
          proxyUrl = `/api/audio-proxy?url=${encodeURIComponent(mediaUrl)}`;
        } else {
          // Para outros tipos, usar o proxy genérico
          proxyUrl = `/api/media-proxy?url=${encodeURIComponent(mediaUrl)}`;
        }
        
        // Salvar a URL no cache e atualizar o estado
        urlCache.set(mediaUrl, proxyUrl);
        setCloudinaryUrl(proxyUrl);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao processar mídia:', err);
        setError('Não foi possível carregar a mídia');
        
        // Usar URL do proxy diretamente como fallback
        const fallbackUrl = `/api/media-proxy?url=${encodeURIComponent(mediaUrl)}`;
        setCloudinaryUrl(fallbackUrl);
        setLoading(false);
      }
    };

    processMediaUrl();
  }, [mediaUrl, mediaType, mimeType]);

  // Renderização durante o carregamento
  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Renderização em caso de erro
  if (error && !cloudinaryUrl) {
    return (
      <div className={`flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
        <p className="text-red-500 text-sm mb-2">{error}</p>
        {finalMediaType === 'image' && <Image className="w-8 h-8 text-gray-400" />}
        {finalMediaType === 'video' && <Video className="w-8 h-8 text-gray-400" />}
        {finalMediaType === 'audio' && <Mic className="w-8 h-8 text-gray-400" />}
        {(finalMediaType === 'document' || finalMediaType === 'unknown') && <File className="w-8 h-8 text-gray-400" />}
      </div>
    );
  }

  // Se não temos URL, não renderizar nada
  if (!cloudinaryUrl) {
    return null;
  }

  // Renderização por tipo de mídia
  switch (finalMediaType) {
    case 'image':
      return (
        <div className={`relative ${className}`}>
          <img 
            src={cloudinaryUrl} 
            alt={caption || 'Imagem'} 
            className="rounded-lg w-full h-auto object-cover"
            style={{ width, height }}
          />
          {caption && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{caption}</div>
          )}
        </div>
      );

    case 'video':
      return (
        <div className={`relative ${className}`}>
          <video 
            src={cloudinaryUrl} 
            controls
            autoPlay={autoPlay}
            className="rounded-lg w-full" 
            style={{ width, height }}
          >
            Seu navegador não suporta a reprodução de vídeos.
          </video>
          {caption && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{caption}</div>
          )}
        </div>
      );

    case 'audio':
      return (
        <div className={`relative ${className}`}>
          <audio 
            src={cloudinaryUrl} 
            controls
            autoPlay={autoPlay}
            className="w-full" 
          >
            Seu navegador não suporta a reprodução de áudios.
          </audio>
          {caption && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{caption}</div>
          )}
        </div>
      );

    case 'document':
      return (
        <div className={`flex items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
          <File className="w-6 h-6 mr-2 text-primary" />
          <a 
            href={cloudinaryUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {caption || 'Abrir documento'}
          </a>
        </div>
      );

    default:
      return (
        <div className={`flex items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
          <File className="w-6 h-6 mr-2 text-gray-400" />
          <a 
            href={cloudinaryUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {caption || 'Baixar arquivo'}
          </a>
        </div>
      );
  }
};