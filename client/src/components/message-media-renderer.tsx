/**
 * Componente para renderizar mídia nas mensagens do WhatsApp
 * Suporta áudios, imagens, vídeos e documentos com reprodução direta
 */
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { 
  FileIcon, ImageIcon, FileVideo, FileAudio, 
  ExternalLink, Play, Pause, Download 
} from "lucide-react";
// Implementando visualização direta com proxies sem uso do Cloudinary

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
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Determinar o tipo de mídia a partir do messageType
  const getMediaType = (): 'image' | 'video' | 'audio' | 'document' | 'unknown' => {
    if (messageType.includes('image')) return 'image';
    if (messageType.includes('video')) return 'video';
    if (messageType.includes('audio')) return 'audio';
    if (messageType.includes('document')) return 'document';
    return 'unknown';
  };
  
  const mediaType = getMediaType();
  
  // Verificar se é um áudio do WhatsApp (.enc)
  const isWhatsAppAudio = mediaUrl?.includes('.enc') && mediaUrl?.includes('/t62.7117-24/');
  
  // Formatar o tamanho do arquivo para exibição
  const formatFileSize = (size: string | number | undefined) => {
    if (!size) return '';
    const numSize = typeof size === 'string' ? parseInt(size) : size;
    if (isNaN(numSize)) return '';
    
    if (numSize < 1024) return `${numSize} B`;
    if (numSize < 1024 * 1024) return `${(numSize / 1024).toFixed(1)} KB`;
    return `${(numSize / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  // Renderizar o cabeçalho da mídia com informações do arquivo
  const renderMediaHeader = () => {
    return (
      <div className="flex items-center space-x-2 text-sm mb-1">
        {mediaType === 'image' && <ImageIcon className="h-5 w-5 text-blue-500" />}
        {mediaType === 'video' && <FileVideo className="h-5 w-5 text-red-500" />}
        {mediaType === 'audio' && <FileAudio className="h-5 w-5 text-green-500" />}
        {(mediaType === 'document' || mediaType === 'unknown') && <FileIcon className="h-5 w-5 text-amber-500" />}
        
        <span className="truncate max-w-[200px]">{fileName || caption || `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}`}</span>
        
        {fileLength && (
          <span className="text-xs text-gray-500 shrink-0">{formatFileSize(fileLength)}</span>
        )}
      </div>
    );
  };
  
  // Renderizar player de áudio nativo para arquivos de áudio do WhatsApp
  const renderAudioPlayer = () => {
    // Criar URL do proxy de áudio para arquivos do WhatsApp
    const getProxyUrl = () => {
      if (!mediaUrl) return '';
      return `/api/audio-proxy?url=${encodeURIComponent(mediaUrl)}`;
    };
    
    const handlePlayAudio = () => {
      setAudioLoading(true);
      setAudioError(false);
      
      // Criar um objeto de áudio usando o proxy
      const proxyUrl = getProxyUrl();
      const audio = new Audio(proxyUrl);
      
      // Configurar eventos para controlar o estado de reprodução
      audio.onplaying = () => {
        setIsAudioPlaying(true);
        setAudioLoading(false);
      };
      
      audio.onpause = () => {
        setIsAudioPlaying(false);
      };
      
      audio.onended = () => {
        setIsAudioPlaying(false);
      };
      
      audio.onerror = () => {
        setAudioLoading(false);
        setIsAudioPlaying(false);
        setAudioError(true);
        console.error('Erro ao reproduzir áudio');
      };
      
      // Iniciar reprodução
      audio.play().catch(err => {
        console.error('Erro ao iniciar reprodução:', err);
        setAudioLoading(false);
        setIsAudioPlaying(false);
        setAudioError(true);
      });
    };
    
    return (
      <div className="mt-3 p-2 bg-white dark:bg-gray-700 rounded-md">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost"
            size="sm"
            onClick={handlePlayAudio}
            disabled={isAudioPlaying || audioLoading}
            className="text-green-500 hover:text-green-600"
          >
            {audioLoading ? (
              <div className="h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
          
          <div className="flex-1 h-1 mx-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-green-500 ${isAudioPlaying ? 'animate-progress' : ''}`} 
              style={{width: isAudioPlaying ? '100%' : '0%'}}
            />
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(mediaUrl, '_blank')}
            className="text-gray-500 hover:text-gray-600"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
        
        {audioError && (
          <div className="text-red-500 text-xs mt-1">
            Não foi possível reproduzir o áudio. Tente fazer o download.
          </div>
        )}
      </div>
    );
  };
  
  // Botão para abrir a mídia em uma nova aba (backup se o renderer não funcionar)
  const renderBackupButton = () => {
    // Criar URL do proxy apropriado para cada tipo de mídia
    const getProxyUrl = () => {
      if (!mediaUrl) return '';
      
      // Usar proxy específico para áudio, caso contrário usar proxy genérico
      if (mediaType === 'audio' && isWhatsAppAudio) {
        return `/api/audio-proxy?url=${encodeURIComponent(mediaUrl)}`;
      } else {
        return `/api/media-proxy?url=${encodeURIComponent(mediaUrl)}`;
      }
    };
    
    return (
      <Button 
        onClick={(e) => {
          e.preventDefault();
          if (mediaUrl) {
            window.open(getProxyUrl(), '_blank');
          }
        }}
        variant="outline" 
        size="sm"
        className="mt-1 w-full"
        disabled={!mediaUrl}
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        
        {mediaType === 'image' && 'Abrir imagem'}
        {mediaType === 'video' && 'Abrir vídeo'}
        {mediaType === 'audio' && 'Abrir áudio'}
        {mediaType === 'document' && 'Abrir documento'}
        {mediaType === 'unknown' && 'Abrir mídia'}
      </Button>
    );
  };
  
  // Verificar se temos uma URL de mídia para exibir
  if (!mediaUrl) {
    return (
      <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-800 ${className}`}>
        <div className="text-red-500 text-sm py-2">
          Mídia não disponível
        </div>
      </div>
    );
  }

  // Função para obter URL do proxy para a mídia
  const getProxyUrl = () => {
    if (!mediaUrl) return '';
    
    // Usar proxy específico para cada tipo de mídia
    if (mediaType === 'audio') {
      return `/api/audio-proxy?url=${encodeURIComponent(mediaUrl)}`;
    } else if (mediaType === 'image') {
      return `/api/media-proxy?url=${encodeURIComponent(mediaUrl)}&type=image`;
    } else if (mediaType === 'video') {
      return `/api/media-proxy?url=${encodeURIComponent(mediaUrl)}&type=video`;
    } else {
      return `/api/media-proxy?url=${encodeURIComponent(mediaUrl)}&type=${mediaType}`;
    }
  };
  
  // Renderizar imagem com proxy
  const renderDirectImage = () => {
    const proxyUrl = getProxyUrl();
    return (
      <div className="relative mt-3">
        <img 
          src={proxyUrl} 
          alt={caption || "Imagem do WhatsApp"} 
          className="max-w-[300px] max-h-[400px] h-auto object-contain rounded-md"
          onError={() => setImageError(true)}
          loading="lazy"
        />
        {caption && (
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {caption}
          </div>
        )}
      </div>
    );
  };
  
  // Renderizar vídeo com proxy
  const renderDirectVideo = () => {
    const proxyUrl = getProxyUrl();
    return (
      <div className="relative mt-3">
        <video 
          src={proxyUrl} 
          controls
          className="max-w-[300px] max-h-[400px] rounded-md"
          preload="metadata"
        >
          Seu navegador não suporta a reprodução de vídeos.
        </video>
        {caption && (
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {caption}
          </div>
        )}
      </div>
    );
  };
  
  // Renderizar documento com link para proxy
  const renderDirectDocument = () => {
    const proxyUrl = getProxyUrl();
    return (
      <div className="mt-3 flex items-center">
        <a 
          href={proxyUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline flex items-center"
        >
          <FileIcon className="h-5 w-5 mr-2" />
          {fileName || "Documento"}
        </a>
        {caption && (
          <div className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            {caption}
          </div>
        )}
      </div>
    );
  };
  
  // Renderizar o componente adequado por tipo de mídia
  return (
    <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-800 ${className}`}>
      {renderMediaHeader()}
      
      {/* Renderização direta por tipo de mídia */}
      {mediaType === 'audio' && renderAudioPlayer()}
      {mediaType === 'image' && renderDirectImage()}
      {mediaType === 'video' && renderDirectVideo()}
      {(mediaType === 'document' || mediaType === 'unknown') && renderDirectDocument()}
      
      {renderBackupButton()}
    </div>
  );
}