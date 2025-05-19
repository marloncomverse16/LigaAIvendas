/**
 * Receptor de webhooks da Evolution API
 * Este módulo recebe automaticamente os webhooks da Evolution API quando configurados
 */
import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { connectionStatus } from '../connection';

const router = Router();

// Middleware para processar os dados do webhook
// A Evolution API envia muitos dados, então precisamos aumentar o limite de tamanho
router.use((req, res, next) => {
  // Log básico de recebimento
  console.log(`Webhook recebido: ${req.method} ${req.path}`);
  next();
});

// Endpoint para receber webhooks de uma instância específica
router.post('/:instance', async (req: Request, res: Response) => {
  const instanceName = req.params.instance;
  const { body } = req;
  
  console.log(`Webhook recebido para instância: ${instanceName}`);
  
  // Log detalhado (limitado para evitar sobrecarregar o console)
  console.log(`Tipo de evento:`, body.event || 'Desconhecido');
  console.log(`Chaves no body:`, Object.keys(body).join(', '));
  
  try {
    // Buscar o usuário pela instância (username)
    const user = await storage.getUserByUsername(instanceName);
    if (!user) {
      console.error(`Usuário não encontrado para a instância: ${instanceName}`);
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }
    
    const userId = user.id;
    
    // Processar o evento com base no tipo
    switch(body.event) {
      case 'qrcode':
        // Processar QR code recebido
        if (body.data && body.data.qrcode) {
          connectionStatus[userId] = {
            connected: false,
            connecting: true,
            qrCode: body.data.qrcode,
            source: 'evolution-webhook',
            lastUpdated: new Date()
          };
          console.log(`QR code atualizado para usuário ${userId}`);
        }
        break;
        
      case 'connection':
        // Processar evento de conexão
        if (body.data && body.data.state === 'open') {
          connectionStatus[userId] = {
            connected: true,
            connecting: false,
            source: 'evolution-webhook',
            name: body.data.name || connectionStatus[userId]?.name,
            phone: body.data.phone || connectionStatus[userId]?.phone,
            lastUpdated: new Date()
          };
          console.log(`Conexão estabelecida para usuário ${userId}`);
        } else if (body.data && body.data.state === 'close') {
          connectionStatus[userId] = {
            connected: false,
            connecting: false,
            source: 'evolution-webhook',
            lastUpdated: new Date()
          };
          console.log(`Conexão fechada para usuário ${userId}`);
        }
        break;
        
      case 'messages':
        // Processar mensagens recebidas
        console.log(`Mensagem recebida para usuário ${userId}`);
        // Aqui poderia salvar a mensagem no banco de dados ou processá-la
        break;
        
      default:
        console.log(`Evento não processado: ${body.event}`);
    }
    
    // Sempre responder com sucesso
    res.status(200).json({ success: true });
    
  } catch (error) {
    console.error(`Erro ao processar webhook:`, error);
    res.status(500).json({ success: false, message: 'Erro interno ao processar webhook' });
  }
});

// Rota GET para verificação/teste
router.get('/:instance', (req: Request, res: Response) => {
  const instanceName = req.params.instance;
  console.log(`Verificação de webhook recebida para instância: ${instanceName}`);
  res.status(200).json({ 
    success: true, 
    message: 'Endpoint de webhook operacional',
    instance: instanceName
  });
});

export default router;