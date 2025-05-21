# Solução para Visualização de Mídias no Replit com Evolution API

## Problema Identificado

Analisando as capturas de tela, identifiquei que o sistema Replit conectado à Evolution API está enfrentando problemas para carregar mídias (imagens, vídeos e áudios) no chat. Especificamente:

1. As imagens mostram erro de carregamento ou aparecem quebradas
2. Os vídeos ficam em loop de carregamento infinito
3. Os áudios não são reproduzidos corretamente

Este é um problema clássico de CORS (Cross-Origin Resource Sharing), onde o navegador bloqueia o acesso a recursos de uma origem diferente por questões de segurança. A Evolution API está servindo as mídias, mas o Replit não consegue acessá-las devido a essas restrições.

## Solução: Implementar um Proxy Reverso no Replit

A solução definitiva é implementar um proxy reverso no seu projeto Replit que irá buscar as mídias da Evolution API e servi-las como se fossem do mesmo domínio, contornando assim as restrições de CORS.

## Instruções Passo a Passo

### 1. Instalar Dependências Necessárias

Adicione as seguintes dependências ao seu projeto Replit:

```bash
npm install express http-proxy-middleware cors axios
```

### 2. Criar o Arquivo de Proxy

Crie um arquivo chamado `proxy-server.js` na raiz do seu projeto com o seguinte conteúdo:

```javascript
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// URL base da sua Evolution API
const EVOLUTION_API_URL = 'https://sua-evolution-api.com'; // Substitua pela URL real da sua API

// Configuração CORS para permitir acesso de qualquer origem
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para fazer log das requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Rota específica para mídia que faz proxy e adiciona headers corretos
app.get('/media-proxy/*', async (req, res) => {
  try {
    // Extrair a URL da mídia da requisição
    const mediaPath = req.url.replace('/media-proxy/', '');
    const mediaUrl = `${EVOLUTION_API_URL}/${mediaPath}`;
    
    console.log(`Buscando mídia de: ${mediaUrl}`);
    
    // Fazer requisição para a Evolution API
    const response = await axios({
      method: 'get',
      url: mediaUrl,
      responseType: 'arraybuffer', // Importante para mídia binária
      headers: {
        // Adicione aqui quaisquer headers necessários para autenticação na Evolution API
      }
    });
    
    // Definir o tipo de conteúdo correto baseado na resposta
    res.setHeader('Content-Type', response.headers['content-type']);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache de 1 hora
    
    // Enviar os dados da mídia
    res.send(Buffer.from(response.data, 'binary'));
  } catch (error) {
    console.error('Erro ao buscar mídia:', error.message);
    res.status(500).send('Erro ao buscar mídia');
  }
});

// Proxy geral para outras requisições à API
app.use('/api', createProxyMiddleware({
  target: EVOLUTION_API_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '', // Remove o prefixo '/api'
  },
  onProxyRes: function(proxyRes, req, res) {
    // Adicionar headers CORS à resposta
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }
}));

// Servir arquivos estáticos (seu frontend)
app.use(express.static('public')); // Ajuste para o diretório onde estão seus arquivos estáticos

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor proxy rodando na porta ${PORT}`);
});
```

### 3. Modificar o Frontend para Usar o Proxy

Você precisa modificar seu código frontend para que todas as requisições de mídia passem pelo proxy. Aqui está como fazer isso:

1. Localize no seu código onde as URLs de mídia são construídas ou utilizadas. Geralmente, isso está em componentes que exibem imagens, vídeos ou áudios.

2. Modifique essas URLs para usar o proxy. Por exemplo:

```javascript
// Antes
const mediaUrl = `https://sua-evolution-api.com/caminho/para/midia.jpg`;

// Depois
const mediaUrl = `/media-proxy/caminho/para/midia.jpg`;
```

### 4. Configurar o Arquivo de Inicialização do Replit

Modifique o arquivo `.replit` ou `replit.nix` para iniciar o servidor proxy:

```
run = "node proxy-server.js"
```

### 5. Configuração Específica para Diferentes Tipos de Mídia

#### Para Imagens

No seu HTML ou JSX, modifique as tags de imagem:

```html
<!-- Antes -->
<img src="https://sua-evolution-api.com/caminho/para/imagem.jpg" />

<!-- Depois -->
<img src="/media-proxy/caminho/para/imagem.jpg" />
```

#### Para Vídeos

```html
<!-- Antes -->
<video controls>
  <source src="https://sua-evolution-api.com/caminho/para/video.mp4" type="video/mp4">
</video>

<!-- Depois -->
<video controls>
  <source src="/media-proxy/caminho/para/video.mp4" type="video/mp4">
</video>
```

#### Para Áudios

```html
<!-- Antes -->
<audio controls>
  <source src="https://sua-evolution-api.com/caminho/para/audio.mp3" type="audio/mpeg">
</audio>

<!-- Depois -->
<audio controls>
  <source src="/media-proxy/caminho/para/audio.mp3" type="audio/mpeg">
</audio>
```

### 6. Função Auxiliar para Converter URLs (Opcional)

Se você tem muitas URLs para converter, pode criar uma função auxiliar:

```javascript
function getProxiedMediaUrl(originalUrl) {
  // Extrair apenas o caminho da URL original
  const url = new URL(originalUrl);
  const path = url.pathname;
  
  // Retornar a URL com o proxy
  return `/media-proxy${path}`;
}

// Exemplo de uso
const mediaUrl = getProxiedMediaUrl('https://sua-evolution-api.com/caminho/para/midia.jpg');
// Resultado: /media-proxy/caminho/para/midia.jpg
```

## Solução Alternativa: Usar um Serviço de Proxy CORS Externo

Se você preferir não modificar seu código no Replit, pode usar um serviço de proxy CORS externo como o CORS Anywhere. No entanto, esta não é uma solução recomendada para produção devido a limitações de uso e possíveis problemas de segurança.

```javascript
// Usando CORS Anywhere (apenas para desenvolvimento)
const mediaUrl = `https://cors-anywhere.herokuapp.com/https://sua-evolution-api.com/caminho/para/midia.jpg`;
```

## Verificação e Depuração

Se após implementar a solução você ainda enfrentar problemas:

1. Verifique o console do navegador para mensagens de erro específicas
2. Confirme se as URLs estão sendo corretamente reescritas para usar o proxy
3. Verifique os logs do servidor proxy para identificar possíveis erros na comunicação com a Evolution API
4. Teste acessando diretamente uma URL de mídia através do proxy no navegador (ex: `https://seu-replit.com/media-proxy/caminho/para/midia.jpg`)

## Considerações de Segurança

1. O proxy implementado permite acesso de qualquer origem (`*`). Em um ambiente de produção, você deve restringir isso apenas às origens necessárias.
2. Considere adicionar autenticação ao proxy se as mídias forem sensíveis ou privadas.
3. Implemente rate limiting para evitar abuso do proxy.

Esta solução deve resolver definitivamente o problema de carregamento de mídias no seu sistema Replit conectado à Evolution API, permitindo que imagens, vídeos e áudios sejam exibidos corretamente no chat.
