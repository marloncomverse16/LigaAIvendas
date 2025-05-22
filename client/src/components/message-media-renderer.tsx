/**
 * Componente para renderizar mídia em mensagens do WhatsApp
 * Agora usa reprodutores integrados baseados no exemplo HTML fornecido
 */
import React from 'react';
import EmbeddedMediaPlayer from './embedded-media-player';

interface MessageMediaRendererProps {
  mediaUrl: string;
  mediaType: string;
  fileName?: string;
  isFromMe: boolean;
}

export const MessageMediaRenderer: React.FC<MessageMediaRendererProps> = ({
  mediaUrl,
  mediaType,
  fileName,
  isFromMe
}) => {
  // Determinar o tipo de mídia baseado no mediaType ou extensão
  const getMediaType = (): 'audio' | 'video' | 'image' => {
    const type = mediaType.toLowerCase();
    
    if (type.includes('audio') || type.includes('ogg')) {
      return 'audio';
    }
    
    if (type.includes('video') || type.includes('mp4') || type.includes('webm')) {
      return 'video';
    }
    
    if (type.includes('image') || type.includes('jpeg') || type.includes('jpg') || type.includes('png') || type.includes('gif')) {
      return 'image';
    }
    
    // Fallback baseado na URL se disponível
    if (mediaUrl) {
      const url = mediaUrl.toLowerCase();
      if (url.includes('audio') || url.includes('.ogg') || url.includes('.mp3') || url.includes('.wav')) {
        return 'audio';
      }
      if (url.includes('video') || url.includes('.mp4') || url.includes('.webm') || url.includes('.avi')) {
        return 'video';
      }
      if (url.includes('image') || url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif')) {
        return 'image';
      }
    }
    
    // Default para imagem se não conseguir determinar
    return 'image';
  };

  if (!mediaUrl) {
    return (
      <div className="media-error">
        Mídia não disponível
      </div>
    );
  }

  return (
    <EmbeddedMediaPlayer
      mediaUrl={mediaUrl}
      mediaType={getMediaType()}
      fileName={fileName}
      isFromMe={isFromMe}
    />
  );
};

export default MessageMediaRenderer;