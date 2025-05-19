/**
 * Módulo para configuração automática de webhook para a Evolution API
 * Este módulo será usado após a criação bem-sucedida de uma instância
 */
import axios from 'axios';

/**
 * Configura o webhook para uma instância específica na Evolution API
 * @param baseUrl URL base da API (ex: https://api.primerastreadores.com)
 * @param token Token de autorização
 * @param instance Nome da instância
 * @param webhookUrl URL do webhook a ser configurado
 * @returns Resultado da operação
 */
export async function configureEvolutionWebhook(
  baseUrl: string, 
  token: string, 
  instance: string, 
  webhookUrl: string
): Promise<any> {
  try {
    console.log(`Configurando webhook para a instância ${instance}: ${webhookUrl}`);
    
    // Configura os headers para autenticação
    const headers = {
      'Content-Type': 'application/json',
      'apikey': token,
      'Authorization': `Bearer ${token}`,
      'AUTHENTICATION_API_KEY': token
    };
    
    // Usar o endpoint /webhook/set para configurar o webhook
    const webhookSetBody = {
      instanceName: instance,
      webhook: webhookUrl,
      webhookByEvents: true,
      events: {
        qrcode: true,
        connection: true,
        messages: true,
        status: true
      }
    };
    
    console.log(`Enviando requisição para ${baseUrl}/webhook/set`);
    console.log('Dados:', JSON.stringify(webhookSetBody));
    
    const response = await axios.post(
      `${baseUrl}/webhook/set`,
      webhookSetBody,
      { headers }
    );
    
    console.log('Resposta da configuração de webhook:', response.data);
    
    if (response.status === 201 || response.status === 200) {
      return {
        success: true,
        data: response.data
      };
    }
    
    return {
      success: false,
      error: "Resposta inesperada ao configurar webhook",
      response: response.data
    };
  } catch (error) {
    console.error("Erro ao configurar webhook:", error.message);
    return {
      success: false,
      error: "Erro ao configurar webhook",
      details: error.message
    };
  }
}