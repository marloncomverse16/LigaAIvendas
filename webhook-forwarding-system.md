# Sistema de Encaminhamento Automático de Webhook WhatsApp Cloud

## Visão Geral

Sistema implementado para encaminhar automaticamente mensagens recebidas do WhatsApp Cloud API para o agente de IA configurado no servidor do usuário.

## Fluxo de Funcionamento

### 1. Recepção da Mensagem
- WhatsApp Cloud API envia mensagem para `/api/meta-webhook` (POST)
- Sistema processa a mensagem e extrai informações relevantes

### 2. Identificação do Usuário
- Sistema busca o usuário baseado no `phone_number_id` da Meta
- Consulta tabela `user_servers` para encontrar relação usuário-servidor
- Verifica se a conexão Meta está ativa (`meta_connected = true`)

### 3. Obtenção da Configuração do Agente IA
- Busca informações do servidor associado ao usuário
- Obtém `ai_agent_webhook_url` e `ai_agent_name` da tabela `servers`

### 4. Encaminhamento Automático
- Se webhook do agente estiver configurado, envia payload padronizado
- Inclui dados da mensagem original e metadados do usuário

## Arquivos Modificados

### `/server/api/meta-webhook.ts`
- `saveIncomingMessage()`: Modificada para incluir encaminhamento automático
- `findUserByPhoneNumberId()`: Nova função para identificar usuário
- `forwardMessageToAI()`: Nova função para encaminhar mensagens

### `/server/routes.ts`
- Adicionadas rotas para webhook Meta:
  - `GET /api/meta-webhook`: Verificação do webhook
  - `POST /api/meta-webhook`: Recepção de mensagens

## Payload Enviado ao Agente de IA

```json
{
  "source": "whatsapp_cloud",
  "from": "554391142751",
  "message": "Texto da mensagem",
  "messageType": "text",
  "timestamp": "2025-06-17T16:46:24.000Z",
  "metadata": {
    "messageId": "wamid.xxx",
    "phoneNumberId": "629117870289911",
    "agentName": "Nome do Agente",
    "platform": "whatsapp_business_cloud"
  },
  "originalPayload": {
    "message": { /* payload original da Meta */ },
    "metadata": { /* metadados originais */ }
  }
}
```

## Configuração Necessária

### 1. Servidor
- Campo `ai_agent_webhook_url` deve estar preenchido
- Campo `ai_agent_name` opcional mas recomendado

### 2. Relação Usuário-Servidor
- Campo `meta_phone_number_id` deve estar configurado
- Campo `meta_connected` deve ser `true`

### 3. Webhook da Meta
- Configurar endpoint `/api/meta-webhook` no Meta Developer Console
- Token de verificação: `META_WEBHOOK_VERIFY_TOKEN`

## Logs de Monitoramento

O sistema gera logs detalhados para monitoramento:
- `🔍 Buscando usuário para phone_number_id: [ID]`
- `✅ Usuário encontrado: [USER_ID], AI Agent: [NOME]`
- `🤖 Encaminhando mensagem para agente de IA: [NOME]`
- `✅ Mensagem encaminhada com sucesso para agente de IA`
- `❌ Erro ao encaminhar mensagem para agente de IA: [ERRO]`

## Tratamento de Erros

- Timeout de 10 segundos para requisições ao webhook
- Log detalhado de erros de rede e HTTP
- Continuidade do processamento mesmo em caso de falha no encaminhamento
- Salvamento da mensagem no banco independente do status do encaminhamento

## Segurança

- Validação do token de verificação do webhook
- Headers personalizados nas requisições (`User-Agent: LigAI-WhatsApp-Cloud/1.0`)
- Isolamento por usuário baseado no `phone_number_id`
- Apenas mensagens de texto são encaminhadas por padrão

## Monitoramento e Debugging

Para verificar o funcionamento:
1. Verificar logs do servidor para mensagens de webhook
2. Confirmar configuração do agente IA no painel administrativo
3. Testar envio de mensagem via WhatsApp para o número configurado
4. Verificar logs de encaminhamento para o webhook do agente

## Próximos Passos

- Expandir suporte para outros tipos de mensagem (imagem, áudio, etc.)
- Implementar retry automático em caso de falha
- Adicionar métricas de performance e taxa de sucesso
- Interface administrativa para monitorar encaminhamentos