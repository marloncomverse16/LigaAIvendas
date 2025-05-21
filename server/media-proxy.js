/**
 * Servidor de proxy dedicado para mídias do WhatsApp
 * Resolve problemas de CORS e formato de dados binários
 */
const axios = require('axios');
const express = require('express');
const router = express.Router();
const cors = require('cors');

// Habilitar CORS para todos os endpoints deste router
router.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/**
 * Rota de proxy específica para mídias do WhatsApp
 * Busca a mídia da URL original e a retorna com headers corretos
 */
router.get('/', async (req, res) => {
  const { url, type, mimetype } = req.query;
  
  if (!url) {
    return res.status(400).send('URL da mídia não fornecida');
  }
  
  console.log(`[Media Proxy] Recebendo requisição para: ${url} (tipo: ${type || 'desconhecido'})`);
  
  try {
    // Tenta buscar a mídia com Axios configurado para dados binários
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      timeout: 15000, // 15 segundos de timeout
      headers: {
        'Accept': '*/*',
        'User-Agent': 'WhatsAppMedia/1.0'
      }
    });
    
    // Determina o tipo de conteúdo correto
    let contentType;
    if (mimetype && mimetype !== 'false') {
      contentType = mimetype;
    } else if (response.headers['content-type']) {
      contentType = response.headers['content-type'];
    } else {
      // Caso não seja possível determinar, tenta inferir pelo tipo ou URL
      if (type === 'image') contentType = 'image/jpeg';
      else if (type === 'video') contentType = 'video/mp4';
      else if (type === 'audio') contentType = 'audio/mpeg';
      else if (type === 'document') contentType = 'application/octet-stream';
      else contentType = 'application/octet-stream';
    }
    
    // Configurar headers de resposta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache de 24 horas
    
    // Apenas para debugging
    console.log(`[Media Proxy] Mídia buscada com sucesso! Tipo: ${contentType}, Tamanho: ${response.data.length} bytes`);
    
    // Retornar os dados binários da mídia
    return res.send(Buffer.from(response.data, 'binary'));
  } catch (error) {
    console.error('[Media Proxy] Erro ao buscar mídia:', error.message);
    
    // Tentar extrair mais informações do erro
    const errorDetails = {
      message: error.message,
      status: error.response?.status || 'Desconhecido',
      headers: error.response?.headers || {},
      url: url
    };
    
    console.error('[Media Proxy] Detalhes do erro:', JSON.stringify(errorDetails, null, 2));
    
    // Retornar erro apropriado
    return res.status(500).json({
      error: 'Erro ao buscar mídia',
      details: errorDetails.message,
      type: type || 'unknown'
    });
  }
});

module.exports = router;