# Configuração do Webhook para Evolution API Chat

Este documento explica como configurar o webhook para receber mensagens em tempo real no Evolution API Chat.

## Visão Geral

Para receber mensagens em tempo real, é necessário configurar um webhook na Evolution API que enviará notificações para um endpoint backend, que por sua vez repassará essas notificações para o frontend.

Como o frontend é uma página HTML estática, não é possível receber diretamente as requisições POST do webhook. Por isso, é necessário um backend intermediário (proxy) para receber essas requisições e repassá-las para o frontend.

## Opções de Implementação

### 1. Servidor Proxy Simples (Recomendado)

Crie um pequeno servidor Node.js que:
1. Receba as requisições POST do webhook da Evolution API
2. Armazene temporariamente as mensagens
3. Forneça um endpoint para o frontend consultar novas mensagens (polling)

Exemplo de código para o servidor proxy:

```javascript
// webhook-proxy.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Armazenamento temporário de mensagens
const messageQueue = {};

// Endpoint para receber webhook da Evolution API
app.post('/webhook/:instanceName', (req, res) => {
    const instanceName = req.params.instanceName;
    console.log(`Webhook recebido para instância ${instanceName}:`, req.body);
    
    // Armazenar mensagem na fila
    if (!messageQueue[instanceName]) {
        messageQueue[instanceName] = [];
    }
    messageQueue[instanceName].push({
        timestamp: Date.now(),
        payload: req.body
    });
    
    // Limitar tamanho da fila (opcional)
    if (messageQueue[instanceName].length > 100) {
        messageQueue[instanceName] = messageQueue[instanceName].slice(-100);
    }
    
    res.status(200).send({ status: 'success' });
});

// Endpoint para o frontend consultar novas mensagens
app.get('/messages/:instanceName', (req, res) => {
    const instanceName = req.params.instanceName;
    const since = parseInt(req.query.since || '0');
    
    // Filtrar mensagens mais recentes que o timestamp fornecido
    const messages = (messageQueue[instanceName] || [])
        .filter(msg => msg.timestamp > since);
    
    res.json({
        timestamp: Date.now(),
        messages: messages
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Webhook proxy rodando na porta ${PORT}`);
});
```

### 2. WebSockets (Para aplicações mais complexas)

Para uma solução mais robusta, você pode implementar WebSockets:

1. Crie um servidor WebSocket que receba as requisições do webhook
2. Envie as mensagens em tempo real para os clientes conectados

### 3. Serviço de Terceiros

Utilize serviços como:
- Firebase Realtime Database
- Pusher
- PubNub
- Socket.io Cloud

## Configuração na Evolution API

1. Acesse o painel de administração da Evolution API
2. Vá para a seção de configuração de webhooks
3. Configure o URL do webhook para apontar para seu servidor proxy:
   ```
   https://seu-servidor.com/webhook/NOME_DA_INSTANCIA
   ```
4. Selecione os eventos que deseja receber (pelo menos `messages.upsert` ou equivalente)
5. Salve as configurações

## Configuração no Frontend

Adicione o seguinte código ao seu arquivo HTML para implementar o polling de mensagens:

```javascript
// Adicione esta função à classe EvolutionChatApp
startMessagePolling() {
    // URL do servidor proxy
    const proxyUrl = 'https://seu-servidor.com';
    let lastTimestamp = Date.now();
    
    // Função para buscar novas mensagens
    const pollMessages = async () => {
        try {
            const response = await fetch(`${proxyUrl}/messages/${this.instanceName}?since=${lastTimestamp}`);
            const data = await response.json();
            
            // Atualizar timestamp
            lastTimestamp = data.timestamp;
            
            // Processar mensagens recebidas
            if (data.messages && data.messages.length > 0) {
                console.log(`Recebidas ${data.messages.length} novas mensagens`);
                data.messages.forEach(msg => {
                    this.processWebhookEvent(msg.payload);
                });
            }
        } catch (error) {
            console.error('Erro ao buscar mensagens:', error);
        }
        
        // Agendar próxima verificação
        setTimeout(pollMessages, 3000); // Verificar a cada 3 segundos
    };
    
    // Iniciar polling
    pollMessages();
}

// Chame esta função no método init() da classe
// this.startMessagePolling();
```

## Teste do Webhook

Para testar o recebimento de mensagens sem configurar o backend, você pode usar a função de simulação incluída no chat:

```javascript
// No console do navegador
window.receiveWebhook({
    event: 'messages.upsert',
    data: {
        messages: [{
            key: {
                remoteJid: '554391142751@s.whatsapp.net',
                fromMe: false,
                id: 'test-123'
            },
            message: {
                conversation: 'Esta é uma mensagem de teste'
            },
            messageTimestamp: Date.now() / 1000
        }]
    }
});
```

## Considerações de Segurança

- Adicione autenticação ao seu servidor proxy para evitar acesso não autorizado
- Considere usar HTTPS para todas as comunicações
- Implemente validação de origem das requisições webhook
- Limite o tamanho e número de mensagens armazenadas no servidor proxy
