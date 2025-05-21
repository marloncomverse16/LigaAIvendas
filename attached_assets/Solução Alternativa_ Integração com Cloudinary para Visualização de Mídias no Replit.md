# Solução Alternativa: Integração com Cloudinary para Visualização de Mídias no Replit

## Problema Identificado

Após a tentativa anterior com proxy reverso não ter funcionado, vamos implementar uma solução alternativa usando o Cloudinary como serviço de armazenamento de mídia. Esta abordagem resolve o problema de CORS de forma definitiva, pois o Cloudinary fornece URLs públicas com os headers CORS corretos.

## Visão Geral da Solução

Em vez de tentar acessar as mídias diretamente da Evolution API, vamos:

1. Interceptar as mídias recebidas da Evolution API
2. Fazer upload automático dessas mídias para o Cloudinary
3. Substituir as URLs originais pelas URLs do Cloudinary no frontend
4. Exibir as mídias usando as URLs públicas do Cloudinary

Esta solução é mais robusta porque o Cloudinary é otimizado para entrega de mídia e já possui todos os headers CORS necessários configurados corretamente.

## Passo a Passo para Implementação

### 1. Criar uma Conta no Cloudinary

1. Acesse [cloudinary.com](https://cloudinary.com/) e crie uma conta gratuita
2. Após o registro, anote seu `cloud_name`, `api_key` e `api_secret` do painel de controle

### 2. Instalar Dependências no Replit

```bash
npm install cloudinary axios express cors multer
```

### 3. Criar o Middleware de Upload para o Cloudinary

Crie um arquivo chamado `cloudinary-config.js` com o seguinte conteúdo:

```javascript
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: 'SEU_CLOUD_NAME',
  api_key: 'SUA_API_KEY',
  api_secret: 'SEU_API_SECRET'
});

// Configuração do storage para o multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'whatsapp_media',
    resource_type: 'auto', // Detecta automaticamente o tipo de arquivo
    public_id: (req, file) => `${Date.now()}-${file.originalname}`
  }
});

// Middleware de upload
const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
```

### 4. Criar o Serviço de Proxy e Upload

Crie um arquivo chamado `media-service.js` com o seguinte conteúdo:

```javascript
const axios = require('axios');
const { cloudinary } = require('./cloudinary-config');
const fs = require('fs');
const path = require('path');
const os = require('os');

// URL base da sua Evolution API
const EVOLUTION_API_URL = 'https://sua-evolution-api.com'; // Substitua pela URL real da sua API

// Cache para evitar uploads duplicados
const mediaCache = new Map();

/**
 * Faz download da mídia da Evolution API e upload para o Cloudinary
 */
async function processMedia(mediaUrl) {
  // Verificar se já temos esta URL no cache
  if (mediaCache.has(mediaUrl)) {
    return mediaCache.get(mediaUrl);
  }

  try {
    // Fazer download da mídia da Evolution API
    const response = await axios({
      method: 'get',
      url: mediaUrl.startsWith('http') ? mediaUrl : `${EVOLUTION_API_URL}/${mediaUrl}`,
      responseType: 'arraybuffer',
      headers: {
        // Adicione aqui quaisquer headers necessários para autenticação na Evolution API
      }
    });

    // Determinar o tipo de mídia
    const contentType = response.headers['content-type'];
    const fileExt = getFileExtensionFromMimeType(contentType);
    
    // Salvar temporariamente o arquivo
    const tempFilePath = path.join(os.tmpdir(), `temp-${Date.now()}${fileExt}`);
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));

    // Fazer upload para o Cloudinary
    const result = await cloudinary.uploader.upload(tempFilePath, {
      resource_type: 'auto',
      folder: 'whatsapp_media'
    });

    // Remover o arquivo temporário
    fs.unlinkSync(tempFilePath);

    // Armazenar no cache
    mediaCache.set(mediaUrl, result.secure_url);
    
    return result.secure_url;
  } catch (error) {
    console.error('Erro ao processar mídia:', error.message);
    throw error;
  }
}

/**
 * Obtém a extensão de arquivo com base no tipo MIME
 */
function getFileExtensionFromMimeType(mimeType) {
  const mimeToExt = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav'
  };
  
  return mimeToExt[mimeType] || '.bin';
}

module.exports = { processMedia };
```

### 5. Criar o Servidor Express para Gerenciar as Requisições

Crie um arquivo chamado `server.js` com o seguinte conteúdo:

```javascript
const express = require('express');
const cors = require('cors');
const { processMedia } = require('./media-service');
const { upload } = require('./cloudinary-config');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para parsing de JSON
app.use(express.json());

// Rota para processar mídia da Evolution API
app.get('/process-media', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL da mídia não fornecida' });
    }
    
    const cloudinaryUrl = await processMedia(url);
    res.json({ url: cloudinaryUrl });
  } catch (error) {
    console.error('Erro ao processar mídia:', error);
    res.status(500).json({ error: 'Erro ao processar mídia' });
  }
});

// Rota para upload direto de arquivos
app.post('/upload', upload.single('media'), (req, res) => {
  try {
    res.json({ url: req.file.path });
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    res.status(500).json({ error: 'Erro ao fazer upload' });
  }
});

// Servir arquivos estáticos (seu frontend)
app.use(express.static('public'));

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
```

### 6. Modificar o Frontend para Usar as URLs do Cloudinary

Você precisa modificar seu código frontend para que, ao receber uma URL de mídia da Evolution API, faça uma requisição para o seu servidor processar essa mídia e obter a URL do Cloudinary.

#### Exemplo de Função para Processar URLs de Mídia

Adicione este código ao seu frontend:

```javascript
/**
 * Processa uma URL de mídia da Evolution API e retorna a URL do Cloudinary
 */
async function processMediaUrl(originalUrl) {
  try {
    const response = await fetch(`/process-media?url=${encodeURIComponent(originalUrl)}`);
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Erro ao processar URL de mídia:', error);
    return originalUrl; // Fallback para a URL original em caso de erro
  }
}

/**
 * Exemplo de uso ao receber uma mensagem com mídia
 */
async function handleMediaMessage(message) {
  if (message.hasMedia) {
    const mediaUrl = message.mediaUrl;
    const cloudinaryUrl = await processMediaUrl(mediaUrl);
    
    // Agora use cloudinaryUrl para exibir a mídia
    if (message.mediaType === 'image') {
      displayImage(cloudinaryUrl);
    } else if (message.mediaType === 'video') {
      displayVideo(cloudinaryUrl);
    } else if (message.mediaType === 'audio') {
      displayAudio(cloudinaryUrl);
    }
  }
}
```

### 7. Integração com a Evolution API

Para integrar com a Evolution API, você precisa interceptar as mensagens recebidas e processar as URLs de mídia. Isso pode ser feito de duas maneiras:

#### Opção 1: Webhook da Evolution API

Configure um webhook na Evolution API para enviar mensagens para seu servidor:

```javascript
// Adicione esta rota ao seu server.js
app.post('/webhook', async (req, res) => {
  try {
    const { message } = req.body;
    
    // Se a mensagem contiver mídia
    if (message.hasMedia) {
      // Processar a URL da mídia
      const cloudinaryUrl = await processMedia(message.mediaUrl);
      
      // Armazenar a associação entre a URL original e a URL do Cloudinary
      // Você pode usar um banco de dados ou um cache para isso
      
      // Responder com sucesso
      res.status(200).json({ success: true });
    } else {
      // Mensagem sem mídia, apenas confirmar recebimento
      res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
});
```

#### Opção 2: Processamento no Frontend

Processe as URLs de mídia diretamente no frontend quando receber mensagens da Evolution API:

```javascript
// Exemplo de código para o frontend
socket.on('message', async (message) => {
  if (message.hasMedia) {
    // Processar a URL da mídia
    message.mediaUrl = await processMediaUrl(message.mediaUrl);
  }
  
  // Exibir a mensagem com a URL processada
  displayMessage(message);
});
```

### 8. Configuração do Arquivo de Inicialização do Replit

Modifique o arquivo `.replit` ou `replit.nix` para iniciar o servidor:

```
run = "node server.js"
```

## Exemplos Específicos para Diferentes Tipos de Mídia

### Para Imagens

```html
<img src="https://res.cloudinary.com/seu-cloud-name/image/upload/v1234567890/whatsapp_media/imagem.jpg" alt="Imagem" />
```

### Para Vídeos

```html
<video controls>
  <source src="https://res.cloudinary.com/seu-cloud-name/video/upload/v1234567890/whatsapp_media/video.mp4" type="video/mp4">
</video>
```

### Para Áudios

```html
<audio controls>
  <source src="https://res.cloudinary.com/seu-cloud-name/video/upload/v1234567890/whatsapp_media/audio.mp3" type="audio/mpeg">
</audio>
```

## Considerações Adicionais

### Segurança

1. Proteja suas credenciais do Cloudinary usando variáveis de ambiente no Replit
2. Considere adicionar autenticação às suas rotas de processamento de mídia
3. Configure corretamente as permissões no Cloudinary para evitar abusos

### Performance

1. O cache implementado evita uploads duplicados, melhorando a performance
2. O Cloudinary otimiza automaticamente as imagens para carregamento rápido
3. Considere implementar um sistema de filas para processamento assíncrono de mídia em grande volume

### Limites do Plano Gratuito do Cloudinary

O plano gratuito do Cloudinary oferece:
- 25GB de armazenamento
- 25GB de largura de banda mensal
- 25.000 transformações por mês

Se seu uso exceder esses limites, considere migrar para um plano pago ou implementar uma política de limpeza para remover mídias antigas.

## Depuração e Solução de Problemas

Se você encontrar problemas:

1. Verifique os logs do servidor para erros durante o upload
2. Confirme se as credenciais do Cloudinary estão corretas
3. Teste o upload manual de um arquivo para o Cloudinary usando a rota `/upload`
4. Verifique se as URLs geradas pelo Cloudinary estão acessíveis diretamente no navegador

Esta solução deve resolver definitivamente o problema de carregamento de mídias no seu sistema Replit conectado à Evolution API, permitindo que imagens, vídeos e áudios sejam exibidos corretamente no chat.
