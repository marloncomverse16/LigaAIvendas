/**
 * Componente simples para visualizar mídia no chat
 * Detecta tipo baseado no messageType da Evolution API
 */
import React, { useState } from 'react';
import { Play, Pause, Download, Volume2, VolumeX } from 'lucide-react';

interface SimpleMediaViewerProps {
  message: any;
  isFromMe: boolean;
}

export const SimpleMediaViewer: React.FC<SimpleMediaViewerProps> = ({
  message,
  isFromMe
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detectar tipo de mídia baseado no messageType
  const getMediaInfo = () => {
    const messageType = message.messageType;
    
    switch (messageType) {
      case 'audioMessage':
        return {
          type: 'audio',
          url: message.message.audioMessage?.url,
          mimetype: message.message.audioMessage?.mimetype || 'audio/ogg',
          seconds: message.message.audioMessage?.seconds
        };
      case 'videoMessage':
        return {
          type: 'video',
          url: message.message.videoMessage?.url,
          mimetype: message.message.videoMessage?.mimetype || 'video/mp4'
        };
      case 'imageMessage':
        return {
          type: 'image',
          url: message.message.imageMessage?.url,
          mimetype: message.message.imageMessage?.mimetype || 'image/jpeg'
        };
      default:
        return null;
    }
  };

  const mediaInfo = getMediaInfo();
  
  if (!mediaInfo || !mediaInfo.url) {
    return (
      <div className="text-sm text-gray-500 p-2">
        Mídia não disponível
      </div>
    );
  }

  // Usar proxy especializado para mídia do WhatsApp
  const buildProxyUrl = () => {
    let url = `/api/whatsapp-media?url=${encodeURIComponent(mediaInfo.url)}&type=${mediaInfo.type}`;
    
    // Para arquivos criptografados, adicionar informações de chave
    if (mediaInfo.url.includes('.enc')) {
      if (message.key) {
        url += `&messageKey=${encodeURIComponent(JSON.stringify(message.key))}`;
      }
      if (message.message[message.messageType]?.mediaKey) {
        url += `&mediaKey=${encodeURIComponent(message.message[message.messageType].mediaKey)}`;
      }
    }
    
    return url;
  };

  const proxyUrl = buildProxyUrl();

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = proxyUrl;
    link.download = `media_${Date.now()}`;
    link.click();
  };

  // Reprodutor de áudio simples
  if (mediaInfo.type === 'audio') {
    return (
      <div className={`p-3 rounded-lg max-w-xs ${isFromMe ? 'bg-green-100' : 'bg-white'} border`}>
        <div className="flex items-center gap-3">
          <button 
            className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600"
            onClick={() => {
              const audio = document.getElementById(`audio_${message.id}`) as HTMLAudioElement;
              if (audio) {
                if (isPlaying) {
                  audio.pause();
                } else {
                  audio.play();
                }
                setIsPlaying(!isPlaying);
              }
            }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">
              Áudio • {mediaInfo.seconds ? `${mediaInfo.seconds}s` : 'Duração desconhecida'}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-gray-200 rounded">
                <div 
                  className="h-1 bg-green-500 rounded"
                  style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                />
              </div>
              <button 
                onClick={handleDownload}
                className="text-gray-500 hover:text-gray-700"
                title="Baixar áudio"
              >
                <Download size={14} />
              </button>
            </div>
          </div>
        </div>
        
        <audio 
          id={`audio_${message.id}`}
          src={proxyUrl}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => setIsPlaying(false)}
          onError={() => setError('Erro ao carregar áudio')}
          style={{ display: 'none' }}
        />
        
        {error && (
          <div className="text-xs text-red-500 mt-1">{error}</div>
        )}
      </div>
    );
  }

  // Visualizador de imagem simples
  if (mediaInfo.type === 'image') {
    return (
      <div className={`relative max-w-xs rounded-lg overflow-hidden ${isFromMe ? 'ml-auto' : 'mr-auto'}`}>
        <img 
          src={proxyUrl}
          alt="Imagem"
          className="w-full h-auto max-h-64 object-cover"
          onError={() => setError('Erro ao carregar imagem')}
        />
        <button 
          onClick={handleDownload}
          className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-70"
          title="Baixar imagem"
        >
          <Download size={14} />
        </button>
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-sm text-red-500">{error}</div>
          </div>
        )}
      </div>
    );
  }

  // Reprodutor de vídeo simples
  if (mediaInfo.type === 'video') {
    return (
      <div className={`relative max-w-sm rounded-lg overflow-hidden ${isFromMe ? 'ml-auto' : 'mr-auto'}`}>
        <video 
          controls
          className="w-full h-auto max-h-64"
          onError={() => setError('Erro ao carregar vídeo')}
        >
          <source src={proxyUrl} type={mediaInfo.mimetype} />
          Seu navegador não suporta vídeo.
        </video>
        <button 
          onClick={handleDownload}
          className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-70"
          title="Baixar vídeo"
        >
          <Download size={14} />
        </button>
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-sm text-red-500">{error}</div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default SimpleMediaViewer;