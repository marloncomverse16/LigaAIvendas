/**
 * Componente de reprodutor de mídia integrado baseado no exemplo HTML fornecido
 * Implementa reprodutores nativos para áudio, vídeo e visualizador de imagem
 */
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Volume2, VolumeX, Maximize2 } from 'lucide-react';

interface EmbeddedMediaPlayerProps {
  mediaUrl: string;
  mediaType: 'audio' | 'video' | 'image';
  fileName?: string;
  isFromMe: boolean;
}

export const EmbeddedMediaPlayer: React.FC<EmbeddedMediaPlayerProps> = ({
  mediaUrl,
  mediaType,
  fileName,
  isFromMe
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Função para obter URL do proxy
  const getProxyUrl = () => {
    if (!mediaUrl) return '';
    
    if (mediaType === 'audio') {
      return `/api/audio-proxy?url=${encodeURIComponent(mediaUrl)}`;
    } else {
      return `/api/media-proxy?url=${encodeURIComponent(mediaUrl)}&type=${mediaType}`;
    }
  };

  // Formatação de tempo
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handlers para áudio
  const toggleAudioPlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = getProxyUrl();
    link.download = fileName || 'media';
    link.click();
  };

  const handleError = () => {
    setError('Erro ao carregar mídia');
    setIsLoading(false);
  };

  // Renderizar reprodutor de áudio
  const renderAudioPlayer = () => (
    <div className={`message-media audio-player ${isFromMe ? 'sent' : 'received'}`}>
      <audio
        ref={audioRef}
        src={getProxyUrl()}
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onError={handleError}
        preload="metadata"
      />
      
      <div className="audio-controls">
        <button 
          className="play-btn"
          onClick={toggleAudioPlay}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="loading-spinner" />
          ) : isPlaying ? (
            <Pause size={20} />
          ) : (
            <Play size={20} />
          )}
        </button>
        
        <div className="audio-progress">
          <div className="time-display">
            {formatTime(currentTime)} / {formatTime(duration || 0)}
          </div>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="progress-bar"
            disabled={isLoading}
          />
        </div>
        
        <div className="audio-actions">
          <button 
            className="volume-btn"
            onClick={toggleMute}
            title={isMuted ? 'Ativar som' : 'Silenciar'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button 
            className="download-btn"
            onClick={handleDownload}
            title="Baixar áudio"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
      
      {error && <div className="media-error">{error}</div>}
    </div>
  );

  // Renderizar reprodutor de vídeo
  const renderVideoPlayer = () => (
    <div className={`message-media video-player ${isFromMe ? 'sent' : 'received'}`}>
      <video
        ref={videoRef}
        src={getProxyUrl()}
        controls
        onError={handleError}
        onLoadedMetadata={() => setIsLoading(false)}
        preload="metadata"
        className="video-element"
      />
      
      <div className="video-actions">
        <button 
          className="download-btn"
          onClick={handleDownload}
          title="Baixar vídeo"
        >
          <Download size={16} />
        </button>
      </div>
      
      {isLoading && (
        <div className="media-loading">
          <div className="loading-spinner" />
          <span>Carregando vídeo...</span>
        </div>
      )}
      
      {error && <div className="media-error">{error}</div>}
    </div>
  );

  // Renderizar visualizador de imagem
  const renderImageViewer = () => (
    <div className={`message-media image-viewer ${isFromMe ? 'sent' : 'received'}`}>
      <img
        src={getProxyUrl()}
        alt={fileName || 'Imagem'}
        className="message-image"
        onClick={() => setShowFullImage(true)}
        onLoad={() => setIsLoading(false)}
        onError={handleError}
      />
      
      <div className="image-actions">
        <button 
          className="fullscreen-btn"
          onClick={() => setShowFullImage(true)}
          title="Ver em tela cheia"
        >
          <Maximize2 size={16} />
        </button>
        <button 
          className="download-btn"
          onClick={handleDownload}
          title="Baixar imagem"
        >
          <Download size={16} />
        </button>
      </div>
      
      {isLoading && (
        <div className="media-loading">
          <div className="loading-spinner" />
          <span>Carregando imagem...</span>
        </div>
      )}
      
      {error && <div className="media-error">{error}</div>}
      
      {/* Modal de imagem em tela cheia */}
      {showFullImage && (
        <div 
          className="image-modal"
          onClick={() => setShowFullImage(false)}
        >
          <div className="image-modal-content">
            <img
              src={getProxyUrl()}
              alt={fileName || 'Imagem'}
              className="fullscreen-image"
            />
            <button 
              className="close-modal"
              onClick={() => setShowFullImage(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar baseado no tipo de mídia
  switch (mediaType) {
    case 'audio':
      return renderAudioPlayer();
    case 'video':
      return renderVideoPlayer();
    case 'image':
      return renderImageViewer();
    default:
      return <div className="media-error">Tipo de mídia não suportado</div>;
  }
};

export default EmbeddedMediaPlayer;