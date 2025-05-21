/**
 * Módulo para proxy de arquivos de mídia do WhatsApp
 * Resolve o problema de arquivos .enc baixados do WhatsApp
 * Inclui conversão para formatos de mídia mais leves e universalmente compatíveis
 */
import { Request, Response } from 'express';
import axios from 'axios';
import { storage } from '../storage';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import stream from 'stream';
import { promisify } from 'util';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Configurar o caminho do ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Caminho para o diretório de mídia temporária
const MEDIA_DIR = path.join(process.cwd(), 'uploads', 'media');
const pipeline = promisify(stream.pipeline);

// Garante que o diretório de mídia exista
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Limpeza periódica de arquivos antigos (a cada 30 minutos)
setInterval(() => {
  try {
    const now = Date.now();
    const files = fs.readdirSync(MEDIA_DIR);
    
    for (const file of files) {
      const filePath = path.join(MEDIA_DIR, file);
      const stats = fs.statSync(filePath);
      // Remove arquivos com mais de 1 hora
      if (now - stats.mtimeMs > 60 * 60 * 1000) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error('Erro ao limpar arquivos temporários:', error);
  }
}, 30 * 60 * 1000);

/**
 * Tenta detectar se o buffer contém uma imagem válida
 * @param buffer Buffer da imagem
 * @returns boolean indicando se é uma imagem válida
 */
async function isValidImage(buffer: Buffer): Promise<boolean> {
  try {
    // Tenta carregar a imagem e obter seus metadados
    const metadata = await sharp(buffer).metadata();
    return !!metadata.format;
  } catch (error) {
    return false;
  }
}

/**
 * Determina se um buffer é um arquivo criptografado do WhatsApp (.enc)
 * @param buffer Buffer do arquivo
 * @returns boolean indicando se é um arquivo .enc
 */
function isEncryptedWhatsAppFile(buffer: Buffer): boolean {
  // Verificação simplificada com base em padrões conhecidos de arquivos .enc
  // Os arquivos .enc do WhatsApp geralmente têm uma assinatura específica
  if (buffer.length < 10) return false;
  
  // Verificar assinaturas conhecidas dos arquivos .enc do WhatsApp
  const headerBytes = buffer.subarray(0, 8);
  const hexHeader = headerBytes.toString('hex');
  
  // Algumas assinaturas conhecidas de arquivos .enc do WhatsApp
  const knownSignatures = [
    '576861747341707020', // "WhatsApp "
    '89504e470d0a1a0a',   // PNG signature
    'ffd8ffe000104a46',   // JPEG signature
    '3c3f786d6c207665',   // XML signature
    '4d4d002a'            // TIFF signature
  ];
  
  return !knownSignatures.some(sig => hexHeader.includes(sig.toLowerCase()));
}

/**
 * Converte uma imagem para um formato mais leve e compatível
 * @param inputBuffer Buffer da imagem original
 * @returns Buffer da imagem convertida
 */
async function convertImage(inputBuffer: Buffer): Promise<Buffer> {
  try {
    // Verificar se o buffer é uma imagem válida
    const isValid = await isValidImage(inputBuffer);
    
    // Se não for uma imagem válida e parece ser um arquivo .enc, apenas retornar
    if (!isValid && isEncryptedWhatsAppFile(inputBuffer)) {
      console.log('Detectado arquivo .enc do WhatsApp, enviando sem processamento');
      return inputBuffer;
    }
    
    // Tenta converter para webp que é mais leve e amplamente suportado
    return await sharp(inputBuffer)
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    console.error('Erro ao converter imagem:', error);
    return inputBuffer;
  }
}

/**
 * Verifica se um arquivo pode ser um vídeo válido
 * @param filePath Caminho para o arquivo
 * @returns Promise<boolean> indicando se é um vídeo válido
 */
async function isValidVideoFile(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Usamos o método padrão sem ffprobe, apenas tentando abrir o arquivo
      const process = ffmpeg(filePath);
      
      process.on('error', () => {
        console.log('Arquivo não é um vídeo válido, erro na leitura');
        resolve(false);
      });
      
      process.on('codecData', () => {
        // Se chegamos aqui, o ffmpeg conseguiu ler o arquivo
        process.kill(); // Importante para não deixar o processo rodando
        resolve(true);
      });
      
      // Definir um timeout para caso a detecção demore muito
      setTimeout(() => {
        try {
          process.kill();
        } catch (e) {
          // Ignorar erros de kill
        }
        resolve(false);
      }, 3000);
      
      // Inicia o processo só para verificação
      process.format('null').output('/dev/null').run();
    } catch (error) {
      console.error('Erro ao verificar arquivo de vídeo:', error);
      resolve(false);
    }
  });
}

/**
 * Converte um vídeo para um formato mais leve e compatível (para navegadores)
 * @param inputPath Caminho para o arquivo original
 * @param outputPath Caminho para o arquivo convertido (MP4) 
 */
async function convertVideo(inputPath: string, outputPath: string): Promise<void> {
  // Primeiro verificamos se o arquivo é um vídeo válido
  const isValid = await isValidVideoFile(inputPath);
  
  if (!isValid) {
    // Se não for um vídeo válido, apenas copiamos o arquivo
    console.log('Arquivo não é um vídeo válido, copiando sem conversão');
    fs.copyFileSync(inputPath, outputPath);
    return;
  }
  
  return new Promise((resolve, reject) => {
    try {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',           // Codec de vídeo H.264
          '-crf 28',                // Qualidade mais baixa para tamanho menor
          '-preset ultrafast',      // Codificação mais rápida
          '-c:a aac',               // Codec de áudio AAC
          '-b:a 128k',              // Bitrate de áudio
          '-movflags +faststart'    // Otimizar para streaming Web
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => {
          console.error('Erro na conversão de vídeo, usando arquivo original:', err);
          // Em caso de erro, apenas copiar o arquivo original
          fs.copyFileSync(inputPath, outputPath);
          resolve();
        })
        .run();
    } catch (error) {
      console.error('Erro fatal na conversão de vídeo:', error);
      // Em caso de erro na execução do ffmpeg, copiar o arquivo original
      fs.copyFileSync(inputPath, outputPath);
      resolve();
    }
  });
}

/**
 * Verifica se um arquivo pode ser um arquivo de áudio válido
 * @param filePath Caminho para o arquivo
 * @returns Promise<boolean> indicando se é um áudio válido
 */
async function isValidAudioFile(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Usamos o método padrão sem ffprobe, apenas tentando abrir o arquivo
      const process = ffmpeg(filePath);
      
      process.on('error', () => {
        console.log('Arquivo não é um áudio válido, erro na leitura');
        resolve(false);
      });
      
      process.on('codecData', () => {
        // Se chegamos aqui, o ffmpeg conseguiu ler o arquivo
        process.kill(); // Importante para não deixar o processo rodando
        resolve(true);
      });
      
      // Definir um timeout para caso a detecção demore muito
      setTimeout(() => {
        try {
          process.kill();
        } catch (e) {
          // Ignorar erros de kill
        }
        resolve(false);
      }, 3000);
      
      // Inicia o processo só para verificação
      process.format('null').output('/dev/null').run();
    } catch (error) {
      console.error('Erro ao verificar arquivo de áudio:', error);
      resolve(false);
    }
  });
}

/**
 * Converte um áudio para um formato mais leve e compatível (MP3)
 * @param inputPath Caminho para o arquivo original
 * @param outputPath Caminho para o arquivo convertido
 */
async function convertAudio(inputPath: string, outputPath: string): Promise<void> {
  // Primeiro verificamos se o arquivo é um áudio válido
  const isValid = await isValidAudioFile(inputPath);
  
  if (!isValid) {
    // Se não for um áudio válido, apenas copiamos o arquivo
    console.log('Arquivo não é um áudio válido, copiando sem conversão');
    fs.copyFileSync(inputPath, outputPath);
    return;
  }
  
  return new Promise((resolve, reject) => {
    try {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:a libmp3lame',     // Codec MP3
          '-b:a 128k',           // Bitrate de áudio
          '-ac 2',               // 2 canais (estéreo)
          '-ar 44100'            // Taxa de amostragem
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => {
          console.error('Erro na conversão de áudio, usando arquivo original:', err);
          // Em caso de erro, apenas copiar o arquivo original
          fs.copyFileSync(inputPath, outputPath);
          resolve();
        })
        .run();
    } catch (error) {
      console.error('Erro fatal na conversão de áudio:', error);
      // Em caso de erro na execução do ffmpeg, copiar o arquivo original
      fs.copyFileSync(inputPath, outputPath);
      resolve();
    }
  });
}

/**
 * Controlador que faz proxy para arquivos de mídia do WhatsApp
 * Permite visualização direta no navegador em vez de download de arquivos .enc
 * Inclui conversão para formatos mais leves e compatíveis
 */
export async function proxyMedia(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  const url = req.query.url as string;
  const type = req.query.type as string;
  const mimetype = req.query.mimetype as string;
  
  if (!url) {
    return res.status(400).json({ message: "URL não fornecida" });
  }

  const userId = req.user.id;
  
  try {
    // Obter o servidor do usuário para pegar o token de autenticação
    const userServers = await storage.getUserServers(userId);
    
    if (!userServers || userServers.length === 0 || !userServers[0].server) {
      return res.status(404).json({ message: "Servidor não configurado" });
    }
    
    const server = userServers[0].server;
    
    if (!server.apiToken) {
      return res.status(404).json({ message: "Token de API não configurado" });
    }

    console.log(`Processando mídia: ${url} (tipo: ${type})`);
    
    // Gerar nome de arquivo único baseado no hash da URL
    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    const fileId = `${urlHash}_${Date.now()}`;
    
    // Determinar extensões e tipos com base no tipo de mídia
    let extension, contentType;
    
    if (type === 'image') {
      extension = '.webp';
      contentType = 'image/webp';
    } else if (type === 'video') {
      extension = '.mp4';
      contentType = 'video/mp4';
    } else if (type === 'audio') {
      extension = '.mp3';
      contentType = 'audio/mpeg';
    } else if (type === 'document') {
      extension = '.pdf';
      contentType = mimetype || 'application/octet-stream';
    } else {
      extension = '.bin';
      contentType = 'application/octet-stream';
    }
    
    // Caminhos para os arquivos temporários
    const tempFilePath = path.join(MEDIA_DIR, `${fileId}_original${extension}`);
    const outputFilePath = path.join(MEDIA_DIR, `${fileId}_converted${extension}`);
    
    console.log(`Baixando arquivo: ${url}`);
    
    // Fazer requisição para a URL da mídia com o token de autenticação
    const mediaResponse = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${server.apiToken}`,
        'apikey': server.apiToken
      },
      timeout: 30000  // Timeout de 30 segundos
    });
    
    if (mediaResponse.status !== 200) {
      throw new Error(`Falha ao recuperar mídia: ${mediaResponse.status}`);
    }
    
    // Processar diferente baseado no tipo de mídia
    if (type === 'image') {
      // Para imagens, converter diretamente na memória
      const convertedImageBuffer = await convertImage(Buffer.from(mediaResponse.data));
      
      // Enviar a imagem convertida
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 1 dia
      return res.send(convertedImageBuffer);
      
    } else if (type === 'video' || type === 'audio') {
      // Para áudio e vídeo, precisamos salvar em arquivo e converter
      fs.writeFileSync(tempFilePath, Buffer.from(mediaResponse.data));
      
      try {
        // Converter o arquivo
        if (type === 'video') {
          await convertVideo(tempFilePath, outputFilePath);
        } else {
          await convertAudio(tempFilePath, outputFilePath);
        }
        
        // Streaming do resultado
        const stat = fs.statSync(outputFilePath);
        const fileSize = stat.size;
        
        // Suporte a streaming parcial (range)
        const range = req.headers.range;
        
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = (end - start) + 1;
          
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400'
          });
          
          const fileStream = fs.createReadStream(outputFilePath, { start, end });
          fileStream.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400'
          });
          
          fs.createReadStream(outputFilePath).pipe(res);
        }
        
        // Agendar limpeza após 5 minutos
        setTimeout(() => {
          try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
          } catch (cleanupError) {
            console.error('Erro na limpeza de arquivos:', cleanupError);
          }
        }, 5 * 60 * 1000);
        
      } catch (conversionError) {
        // Se a conversão falhar, retornar o arquivo original
        console.error('Erro na conversão, enviando arquivo original:', conversionError);
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', mediaResponse.data.length);
        return res.send(mediaResponse.data);
      }
      
    } else {
      // Para outros tipos, enviar diretamente
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', mediaResponse.data.length);
      return res.send(mediaResponse.data);
    }
    
  } catch (error: any) {
    console.error('Erro ao processar mídia:', error);
    
    // Se tiver resposta do servidor, enviar os detalhes
    if (error.response) {
      return res.status(error.response.status || 500).json({
        message: 'Erro ao obter ou processar mídia',
        status: error.response.status,
        statusText: error.response.statusText
      });
    }
    
    // Erro genérico
    return res.status(500).json({
      message: 'Erro ao processar mídia',
      error: error.message || 'Erro desconhecido'
    });
  }
}