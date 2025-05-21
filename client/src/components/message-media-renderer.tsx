/**
 * Componente para renderizar mídia nas mensagens do WhatsApp
 * Com suporte a visualização direta de imagens, vídeos, áudios e documentos
 * Usa o serviço de proxy para converter arquivos criptografados (.enc) em formatos mais leves
 */
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FileIcon, ImageIcon, FileVideo, FileAudio, ExternalLink, Loader2 } from "lucide-react";

interface MessageMediaRendererProps {
  messageType: string;                   // Tipo de mensagem (imageMessage, videoMessage, audioMessage, documentMessage)
  mediaUrl?: string;                     // URL original da mídia
  mimeType?: string;                     // Tipo MIME da mídia
  fileName?: string;                     // Nome do arquivo (para documentos)
  caption?: string;                      // Legenda da mídia
  fileLength?: number | string;          // Tamanho do arquivo
  className?: string;                    // Classes CSS adicionais
}

/**
 * Componente para renderizar diferentes tipos de mídia das mensagens do WhatsApp
 */
export function MessageMediaRenderer({
  messageType,
  mediaUrl,
  mimeType,
  fileName,
  caption,
  fileLength,
  className = ''
}: MessageMediaRendererProps) {
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaRendered, setMediaRendered] = useState(false);
  
  // Determinar o tipo de mídia a partir do messageType
  const getMediaType = () => {
    if (messageType.includes('image')) return 'image';
    if (messageType.includes('video')) return 'video';
    if (messageType.includes('audio')) return 'audio';
    if (messageType.includes('document')) return 'document';
    return 'unknown';
  };
  
  const mediaType = getMediaType();
  
  // Formatar o tamanho do arquivo para exibição
  const formatFileSize = (size: string | number | undefined) => {
    if (!size) return '';
    const numSize = typeof size === 'string' ? parseInt(size) : size;
    if (isNaN(numSize)) return '';
    
    if (numSize < 1024) return `${numSize} B`;
    if (numSize < 1024 * 1024) return `${(numSize / 1024).toFixed(1)} KB`;
    return `${(numSize / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  // Construir a URL para o proxy de mídia
  const getMediaProxyUrl = () => {
    if (!mediaUrl) return '';
    
    const params = new URLSearchParams();
    params.append('url', mediaUrl);
    params.append('type', mediaType);
    if (mimeType && mimeType !== 'false') params.append('mimetype', mimeType);
    
    return `/api/proxy-media?${params.toString()}`;
  };

  // Carregar e exibir mídia
  const handleViewMedia = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!mediaUrl) {
      setMediaError('URL da mídia não disponível');
      return;
    }
    
    setLoadingMedia(true);
    setMediaError(null);
    
    const proxyUrl = getMediaProxyUrl();
    
    // Para imagens e vídeos, tenta renderizar no componente
    if (mediaType === 'image' || mediaType === 'video') {
      setMediaRendered(true);
    } else {
      // Para outros tipos, abre em nova aba
      window.open(proxyUrl, '_blank');
      setLoadingMedia(false);
    }
  };
  
  // Renderizar o componente de acordo com o tipo de mídia
  const renderMediaContent = () => {
    if (loadingMedia && !mediaRendered) {
      return (
        <div className="flex flex-col items-center justify-center py-4">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">Carregando mídia...</p>
        </div>
      );
    }
    
    if (mediaError) {
      return (
        <div className="text-red-500 text-sm py-2">
          Erro: {mediaError}
        </div>
      );
    }

    if (mediaRendered && mediaType === 'image') {
      return (
        <div className="mt-2">
          <img 
            src={getMediaProxyUrl()} 
            alt={caption || "Imagem"} 
            className="max-w-full rounded-md object-contain max-h-60"
            onLoad={() => setLoadingMedia(false)}
            onError={() => {
              setMediaError('Não foi possível carregar a imagem');
              setLoadingMedia(false);
              setMediaRendered(false);
            }}
          />
          {caption && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{caption}</p>}
        </div>
      );
    }
    
    if (mediaRendered && mediaType === 'video') {
      return (
        <div className="mt-2">
          <video 
            src={getMediaProxyUrl()} 
            controls 
            className="max-w-full rounded-md max-h-60"
            onLoadedData={() => setLoadingMedia(false)}
            onError={() => {
              setMediaError('Não foi possível carregar o vídeo');
              setLoadingMedia(false);
              setMediaRendered(false);
            }}
          />
          {caption && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{caption}</p>}
        </div>
      );
    }
    
    // Renderização dos ícones e botões para os diferentes tipos de mídia
    return (
      <div className="flex flex-col">
        <div className="flex items-center space-x-2 text-sm mb-1">
          {mediaType === 'image' && <ImageIcon className="h-5 w-5 text-blue-500" />}
          {mediaType === 'video' && <FileVideo className="h-5 w-5 text-red-500" />}
          {mediaType === 'audio' && <FileAudio className="h-5 w-5 text-green-500" />}
          {mediaType === 'document' && <FileIcon className="h-5 w-5 text-amber-500" />}
          
          <span>{fileName || caption || `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}`}</span>
          
          {fileLength && (
            <span className="text-xs text-gray-500">{formatFileSize(fileLength)}</span>
          )}
        </div>
        
        <Button 
          onClick={handleViewMedia}
          variant="outline" 
          size="sm"
          className="mt-1 w-full"
          disabled={loadingMedia || !mediaUrl}
        >
          {loadingMedia ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ExternalLink className="h-4 w-4 mr-2" />
          )}
          
          {mediaType === 'image' && 'Visualizar imagem'}
          {mediaType === 'video' && 'Visualizar vídeo'}
          {mediaType === 'audio' && 'Ouvir áudio'}
          {mediaType === 'document' && 'Abrir documento'}
        </Button>
      </div>
    );
  };
  
  return (
    <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-800 ${className}`}>
      {renderMediaContent()}
    </div>
  );
}