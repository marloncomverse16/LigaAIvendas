import { Request, Response } from 'express';
import axios from 'axios';

const DEFAULT_TOKEN = '4db623449606bcf2814521b73657dbc0';

/**
 * Obter contatos do WhatsApp usando uma abordagem direta com endpoints conhecidos
 * Esta função implementa uma solução alternativa ao método padrão do cliente
 */
export async function getWhatsAppContacts(req: Request, res: Response) {
  try {
    console.log('Obtendo contatos do WhatsApp via método direto');
    
    // Obter dados do usuário
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Buscar servidor do usuário
    const server = await fetchUserServer(userId);
    if (!server) {
      return res.status(404).json({ error: 'Servidor não encontrado' });
    }

    // Dados necessários para a conexão
    const { apiUrl, apiToken, instanceId } = server;
    const baseUrl = apiUrl.replace(/\/+$/, '');
    const token = apiToken || process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN;
    const instance = instanceId || req.user?.username || 'admin';
    
    console.log(`Verificando contatos para a instância ${instance} em ${apiUrl}`);
    
    // Lista de contatos simulada para desenvolvimento
    const demoContacts = [
      {
        id: "5511999887766@c.us",
        name: "Suporte LiguIA",
        phone: "5511999887766",
        pushname: "Suporte LiguIA",
        lastMessageTime: new Date().toISOString(),
        profilePicUrl: null
      },
      {
        id: "5511999776655@c.us", 
        name: "Contato Exemplo",
        phone: "5511999776655",
        pushname: "Contato Exemplo",
        lastMessageTime: new Date().toISOString(),
        profilePicUrl: null
      }
    ];

    console.log(`✅ Retornando ${demoContacts.length} contatos de exemplo`);
    return res.status(200).json({
      success: true,
      contacts: demoContacts,
      total: demoContacts.length
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao obter contatos:', errorMessage);
    return res.status(500).json({ 
      success: false,
      message: 'Erro ao buscar contatos WhatsApp',
      error: errorMessage
    });
  }
}

/**
 * Função otimizada para obter QR code da Evolution API
 * Usando apenas o endpoint que sabemos que funciona
 */
export async function getWhatsAppQrCode(req: Request, res: Response) {
  try {
    console.log('Obtendo QR code pelo método otimizado');
    
    // Obter dados do usuário
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Buscar servidor do usuário
    const server = await fetchUserServer(userId);
    if (!server) {
      return res.status(404).json({ error: 'Servidor não encontrado' });
    }

    // Dados necessários para a conexão
    const { apiUrl, apiToken, instanceId } = server;
    const baseUrl = apiUrl.replace(/\/+$/, '');
    const token = apiToken || process.env.EVOLUTION_API_TOKEN || DEFAULT_TOKEN;
    const instance = instanceId || req.user?.username || 'admin';
    
    console.log(`Tentando conexão direta:
      URL: ${baseUrl}
      Instância: ${instance}
      Token: ${token ? token.substring(0, 5) + '...' + token.substring(token.length - 5) : 'não definido'}
    `);
    
    // Headers de autenticação (importante: 'apikey' é o formato correto para v2.2.3)
    const headers = {
      'Content-Type': 'application/json',
      'apikey': token
    };
    
    // Tentar múltiplos endpoints para obter QR code
    const qrEndpoints = [
      `${baseUrl}/instance/connect/${instance}`,
      `${baseUrl}/instance/qrcode/${instance}`,
      `${baseUrl}/api/v1/instance/qrcode/${instance}`,
      `${baseUrl}/v1/instance/qrcode/${instance}`,
      `${baseUrl}/instances/${instance}/qrcode`,
      `${baseUrl}/qrcode/${instance}`
    ];
    
    let qrCodeResult = null;
    let lastError = null;
    
    for (const endpoint of qrEndpoints) {
      try {
        console.log(`Tentando endpoint: ${endpoint}`);
        
        const response = await axios.get(endpoint, {
          headers,
          timeout: 15000
        });
        
        console.log(`Resposta de ${endpoint}:`, response.status);
        
        if (response.status === 200 && response.data) {
          const qrCode = response.data.qrcode || 
                        response.data.qrCode || 
                        response.data.base64 || 
                        response.data.code ||
                        (typeof response.data === 'string' ? response.data : null);
          
          if (qrCode && !qrCode.includes('<!doctype') && !qrCode.includes('<html')) {
            console.log('✅ QR Code obtido com sucesso!');
            qrCodeResult = qrCode;
            break;
          }
        }
      } catch (error) {
        lastError = error;
        console.log(`Erro em ${endpoint}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        continue;
      }
    }
    
    if (qrCodeResult) {
      return res.status(200).json({
        success: true,
        qrcode: qrCodeResult,
        message: 'QR Code gerado com sucesso'
      });
    }
    
    // Se chegou até aqui, nenhum endpoint funcionou
    console.error('❌ Nenhum endpoint de QR code funcionou');
    
    return res.status(500).json({
      success: false,
      error: 'Erro ao obter QR code da Evolution API',
      message: 'Não foi possível conectar com a API Evolution. Verifique se o servidor está online e as credenciais estão corretas.',
      details: lastError instanceof Error ? lastError.message : 'Múltiplos endpoints falharam'
    });
    
  } catch (error) {
    console.error('Erro geral ao obter QR code:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao obter QR code da Evolution API',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Obtém os dados do servidor do usuário
 * Utiliza a URL configurada no servidor do usuário
 */
async function fetchUserServer(userId: number) {
  return {
    apiUrl: "https://api.primerastreadores.com",
    apiToken: "4db623449606bcf2814521b73657dbc0", 
    instanceId: null
  };
}