# Documentação Completa da Evolution API

## Índice

1. [Informações Gerais](#informações-gerais)
2. [Instâncias](#instâncias)
3. [Webhook](#webhook)
4. [Configurações](#configurações)
5. [Mensagens](#mensagens)
6. [Chat](#chat)
7. [Perfil](#perfil)
8. [Grupos](#grupos)

## Informações Gerais

### Get Information

**Endpoint:** GET /

**Descrição:** Obtém informações sobre o estado atual da API.

**Resposta:**
- HTTP status da resposta
- Mensagem descritiva sobre o estado atual da API
- Versão atual da API
- URL para a documentação Swagger da API
- URL para a documentação detalhada da API

**Exemplo de resposta:**
```json
{
  "status": 200,
  "message": "Welcome to the Evolution API, it is working!",
  "version": "1.7.4",
  "swagger": "http://example.evolution-api.com/docs",
  "manager": "http://example.evolution-api.com/manager",
  "documentation": "https://doc.evolution-api.com"
}
```

## Instâncias

### Create Instance

**Endpoint:** POST /instance/create

**Descrição:** Cria uma nova instância do WhatsApp.

**Parâmetros do corpo (JSON):**
```json
{
  "instanceName": "<string>",
  "token": "<string>",
  "qrcode": true,
  "number": "<string>",
  "integration": "WHATSAPP-BAILEYS",
  "rejectCall": true,
  "msgCall": "<string>",
  "groupsIgnore": true,
  "alwaysOnline": true,
  "readMessages": true,
  "readStatus": true,
  "syncFullHistory": true,
  "proxyHost": "<string>",
  "proxyPort": "<string>",
  "proxyProtocol": "<string>",
  "proxyUsername": "<string>",
  "proxyPassword": "<string>",
  "webhook": {
    "url": "<string>",
    "byEvents": true,
    "base64": true
  }
}
```

**Headers necessários:**
- Content-Type: application/json
- apikey: <api-key>

### Fetch Instances

**Endpoint:** GET /instance/fetchInstances

**Descrição:** Obtém a lista de todas as instâncias criadas.

### Instance Connect

**Endpoint:** GET /instance/connect

**Descrição:** Conecta uma instância específica.

**Parâmetros de caminho:**
- instance: string (ID da instância para conectar)

### Restart Instance

**Endpoint:** PUT /instance/restart

**Descrição:** Reinicia uma instância específica.

**Parâmetros de caminho:**
- instance: string (ID da instância para reiniciar)

### Connection State

**Endpoint:** GET /instance/connectionState

**Descrição:** Verifica o estado de conexão de uma instância.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Logout Instance

**Endpoint:** DEL /instance/logout

**Descrição:** Desconecta uma instância específica.

**Parâmetros de caminho:**
- instance: string (ID da instância para desconectar)

### Delete Instance

**Endpoint:** DEL /instance/delete

**Descrição:** Exclui uma instância específica.

**Parâmetros de caminho:**
- instance: string (ID da instância para excluir)

### Set Presence

**Endpoint:** POST /instance/setPresence

**Descrição:** Define o status de presença de uma instância.

**Parâmetros de caminho:**
- instance: string (ID da instância)

## Webhook

### Set Webhook

**Endpoint:** POST /instance/webhook

**Descrição:** Configura um webhook para uma instância.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Find Webhook

**Endpoint:** GET /instance/webhook

**Descrição:** Obtém as configurações de webhook de uma instância.

**Parâmetros de caminho:**
- instance: string (ID da instância)

## Configurações

### Set Settings

**Endpoint:** POST /instance/settings

**Descrição:** Configura as definições de uma instância.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Find Settings

**Endpoint:** GET /instance/settings

**Descrição:** Obtém as configurações de uma instância.

**Parâmetros de caminho:**
- instance: string (ID da instância)

## Mensagens

### Send Plain Text

**Endpoint:** POST /message/sendText

**Descrição:** Envia uma mensagem de texto simples.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Send Status

**Endpoint:** POST /message/sendStatus

**Descrição:** Envia uma mensagem de status.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Send Media

**Endpoint:** POST /message/sendMedia

**Descrição:** Envia uma mensagem com mídia.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Send WhatsApp Audio

**Endpoint:** POST /message/sendWhatsAppAudio

**Descrição:** Envia um áudio no formato do WhatsApp.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Send Sticker

**Endpoint:** POST /message/sendSticker

**Descrição:** Envia um sticker.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Send Location

**Endpoint:** POST /message/sendLocation

**Descrição:** Envia uma localização.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Send Contact

**Endpoint:** POST /message/sendContact

**Descrição:** Envia um contato.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Send Reaction

**Endpoint:** POST /message/sendReaction

**Descrição:** Envia uma reação a uma mensagem.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Send Poll

**Endpoint:** POST /message/sendPoll

**Descrição:** Envia uma enquete.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Send List

**Endpoint:** POST /message/sendList

**Descrição:** Envia uma lista de opções.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Send Buttons

**Endpoint:** POST /message/sendButtons

**Descrição:** Envia botões interativos.

**Parâmetros de caminho:**
- instance: string (ID da instância)

## Chat

### Check is WhatsApp

**Endpoint:** POST /chat/whatsappNumbers

**Descrição:** Verifica se um número está registrado no WhatsApp.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Mark Message As Read

**Endpoint:** POST /chat/markMessageAsRead

**Descrição:** Marca uma mensagem como lida.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Mark Message As Unread

**Endpoint:** POST /chat/markMessageAsUnread

**Descrição:** Marca uma mensagem como não lida.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Archive Chat

**Endpoint:** POST /chat/archiveChat

**Descrição:** Arquiva um chat.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Delete Message for Everyone

**Endpoint:** DEL /chat/deleteMessageForEveryone

**Descrição:** Deleta uma mensagem para todos os participantes.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Update Message

**Endpoint:** POST /chat/updateMessage

**Descrição:** Atualiza uma mensagem.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Send Presence

**Endpoint:** POST /chat/sendPresence

**Descrição:** Envia status de presença em um chat.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Update Block Status

**Endpoint:** POST /chat/updateBlockStatus

**Descrição:** Atualiza o status de bloqueio de um contato.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Fetch Profile Picture URL

**Endpoint:** POST /chat/fetchProfilePictureUrl

**Descrição:** Obtém a URL da foto de perfil de um contato.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Get Base64

**Endpoint:** POST /chat/getBase64

**Descrição:** Obtém uma mídia em formato Base64.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Find Contacts

**Endpoint:** POST /chat/findContacts

**Descrição:** Busca contatos.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Find Messages

**Endpoint:** POST /chat/findMessages

**Descrição:** Busca mensagens.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Find Status Message

**Endpoint:** POST /chat/findStatusMessage

**Descrição:** Busca mensagens de status.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Find Chats

**Endpoint:** POST /chat/findChats

**Descrição:** Busca chats.

**Parâmetros de caminho:**
- instance: string (ID da instância)

## Perfil

### Fetch Business Profile

**Endpoint:** POST /profile/fetchBusinessProfile

**Descrição:** Obtém o perfil de negócios.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Fetch Profile

**Endpoint:** POST /profile/fetchProfile

**Descrição:** Obtém o perfil do usuário.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Update Profile Name

**Endpoint:** POST /profile/updateProfileName

**Descrição:** Atualiza o nome do perfil.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Update Profile Status

**Endpoint:** POST /profile/updateProfileStatus

**Descrição:** Atualiza o status do perfil.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Update Profile Picture

**Endpoint:** POST /profile/updateProfilePicture

**Descrição:** Atualiza a foto do perfil.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Remove Profile Picture

**Endpoint:** DEL /profile/removeProfilePicture

**Descrição:** Remove a foto do perfil.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Fetch Privacy Settings

**Endpoint:** GET /profile/fetchPrivacySettings

**Descrição:** Obtém as configurações de privacidade.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Update Privacy Settings

**Endpoint:** POST /profile/updatePrivacySettings

**Descrição:** Atualiza as configurações de privacidade.

**Parâmetros de caminho:**
- instance: string (ID da instância)

## Grupos

### Create Group

**Endpoint:** POST /group/create

**Descrição:** Cria um novo grupo.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Update Group Picture

**Endpoint:** POST /group/updateGroupPicture

**Descrição:** Atualiza a foto do grupo.

**Parâmetros de caminho:**
- instance: string (ID da instância)

### Update Group Subject

**Endpoint:** POST /group/updateGroupSubject

**Descrição:** Atualiza o assunto/nome do grupo.

**Parâmetros de caminho:**
- instance: string (ID da instância)
