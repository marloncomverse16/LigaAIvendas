/**
 * Componente para renderizar mídia nas mensagens do WhatsApp
 * Usa o Cloudinary para armazenar e otimizar as mídias, resolvendo problemas de CORS
 * Implementação melhorada que suporta todos os tipos de mídia (imagens, vídeos, áudios, documentos)
 */
import React from 'react';
import { Button } from "@/components/ui/button";
import { FileIcon, ImageIcon, FileVideo, FileAudio, ExternalLink } from "lucide-react";
import { CloudinaryMediaRenderer } from './cloudinary-media-renderer';

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
  // Determinar o tipo de mídia a partir do messageType
  const getMediaType = (): 'image' | 'video' | 'audio' | 'document' | 'unknown' => {
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
  
  // Botão para abrir a mídia em uma nova aba (backup se o renderer não funcionar)
  const renderBackupButton = () => {
    return (
      <Button 
        onClick={(e) => {
          e.preventDefault();
          if (mediaUrl) {
            window.open(`/api/process-media?url=${encodeURIComponent(mediaUrl)}`, '_blank');
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

  // Renderizar o componente com o CloudinaryMediaRenderer
  return (
    <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-800 ${className}`}>
      {renderMediaHeader()}
      
      <CloudinaryMediaRenderer 
        mediaUrl={mediaUrl}
        mediaType={mediaType}
        mimeType={mimeType !== 'false' ? mimeType : undefined}
        caption={caption}
        className="mt-3"
      />
      
      {renderBackupButton()}
    </div>
  );
}