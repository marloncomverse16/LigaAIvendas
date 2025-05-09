/**
 * Módulo para integração com a API do WhatsApp Cloud da Meta
 * Documentação da API: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import axios from "axios";

// Função para obter os templates de mensagem da API da Meta
export async function getMetaApiTemplates(
  whatsappMetaToken: string,
  whatsappMetaBusinessId: string,
  apiVersion: string = "v18.0"
) {
  try {
    if (!whatsappMetaToken || !whatsappMetaBusinessId) {
      throw new Error("Meta API não configurada corretamente. Token e Business ID são obrigatórios.");
    }

    console.log(`Buscando templates via API: ${apiVersion}/${whatsappMetaBusinessId}/message_templates`);
    const endpoint = `https://graph.facebook.com/${apiVersion}/${whatsappMetaBusinessId}/message_templates`;
    
    console.log(`Endpoint de templates: ${endpoint}`);
    const response = await axios.get(endpoint, {
      headers: {
        Authorization: `Bearer ${whatsappMetaToken}`,
        "Content-Type": "application/json",
      },
    });
    
    console.log(`Resposta da API de templates: status ${response.status}`);
    console.log('Headers:', JSON.stringify(response.headers));
    console.log('Dados:', JSON.stringify(response.data));

    if (response.data && response.data.data) {
      return {
        success: true,
        templates: response.data.data.map((template: any) => ({
          id: template.id,
          name: template.name,
          status: template.status,
          category: template.category,
          language: template.language,
          components: template.components,
        })),
      };
    } else {
      return {
        success: false,
        error: "Nenhum template encontrado na API da Meta",
      };
    }
  } catch (error: any) {
    console.error("Erro ao buscar templates da Meta API:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

// Função para enviar mensagem usando a API da Meta
export async function sendMetaApiMessage(
  whatsappMetaToken: string,
  whatsappMetaBusinessId: string,
  phoneNumberId: string,
  templateName: string,
  to: string,
  apiVersion: string = "v18.0",
  language: string = "pt_BR",
  components: any[] = []
) {
  try {
    if (!whatsappMetaToken || !whatsappMetaBusinessId || !phoneNumberId) {
      throw new Error("Meta API não configurada corretamente");
    }

    const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    
    const messageData: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: language
        }
      }
    };

    // Adicionar componentes se fornecidos
    if (components && components.length > 0) {
      messageData.template.components = components;
    }

    const response = await axios.post(endpoint, messageData, {
      headers: {
        Authorization: `Bearer ${whatsappMetaToken}`,
        "Content-Type": "application/json",
      },
    });

    return {
      success: true,
      messageId: response.data.messages[0].id,
      response: response.data
    };
  } catch (error: any) {
    console.error("Erro ao enviar mensagem pela Meta API:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}