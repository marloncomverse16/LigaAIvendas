import type { Request, Response } from "express";
import axios from "axios";
import { db } from "../db";
import { userServers, servers } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Implementação corrigida para gerar QR Code seguindo as regras:
 * 1. Deletar instância existente (se houver)
 * 2. Criar nova instância
 * 3. Gerar QR Code
 */
export async function generateQrCodeFixed(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  try {
    const userId = req.user.id;
    const instanceName = req.user.username || "admin";

    console.log(`🔄 Gerando QR Code para usuário ${userId} (instância: ${instanceName})`);

    // Buscar configuração do servidor Evolution API do usuário
    const userServerData = await db
      .select({
        serverId: userServers.serverId,
        serverData: servers
      })
      .from(userServers)
      .leftJoin(servers, eq(userServers.serverId, servers.id))
      .where(eq(userServers.userId, userId))
      .limit(1);

    if (!userServerData.length || !userServerData[0].serverData) {
      return res.status(400).json({
        success: false,
        error: "Servidor Evolution API não configurado",
        message: "Configure primeiro na aba 'Configurações > Servidores'"
      });
    }

    const serverConfig = userServerData[0].serverData;
    const baseUrl = serverConfig.apiUrl;
    const apiKey = serverConfig.apiToken;

    if (!baseUrl || !apiKey) {
      return res.status(400).json({
        success: false,
        error: "URL da API ou Token não configurados",
        message: "Verifique a configuração do servidor na aba 'Configurações > Servidores'"
      });
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'apikey': apiKey
    };

    console.log(`🌐 Usando servidor: ${baseUrl}`);
    console.log(`🔑 Token configurado: ${apiKey.substring(0, 10)}...`);

    // ETAPA 1: Deletar instância existente (se houver)
    try {
      console.log(`🗑️ ETAPA 1: Deletando instância existente "${instanceName}"...`);
      const deleteUrl = `${baseUrl}/instance/delete/${instanceName}`;
      
      const deleteResponse = await axios.delete(deleteUrl, { 
        headers,
        timeout: 10000 
      });
      
      console.log(`✅ Instância deletada com sucesso:`, deleteResponse.status);
    } catch (deleteError: any) {
      // Erro 404 é normal se a instância não existia
      if (deleteError.response?.status === 404) {
        console.log(`ℹ️ Instância "${instanceName}" não existia (404 - normal)`);
      } else {
        console.log(`⚠️ Erro ao deletar instância (continuando):`, deleteError.message);
      }
    }

    // Aguardar um pouco antes de criar nova instância
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ETAPA 2: Criar nova instância
    console.log(`🔨 ETAPA 2: Criando nova instância "${instanceName}"...`);
    const createUrl = `${baseUrl}/instance/create`;
    
    const createData = {
      instanceName: instanceName,
      token: apiKey,
      webhook: null,
      webhookByEvents: false,
      integration: "WHATSAPP-BAILEYS",
      language: "pt-BR",
      qrcode: true,
      qrcodeImage: true,
      reject_call: false,
      events_message: false,
      ignore_group: false,
      ignore_broadcast: false,
      save_message: true,
      webhook_base64: true
    };

    let createResponse;
    try {
      createResponse = await axios.post(createUrl, createData, { 
        headers,
        timeout: 15000 
      });
      
      console.log(`✅ Instância criada com sucesso:`, createResponse.status);
      console.log(`📄 Resposta da criação:`, createResponse.data);
    } catch (createError: any) {
      console.error(`❌ Erro ao criar instância:`, createError.message);
      if (createError.response) {
        console.error(`Status: ${createError.response.status}`);
        console.error(`Dados: ${JSON.stringify(createError.response.data)}`);
      }
      
      return res.status(500).json({
        success: false,
        error: "Falha ao criar instância WhatsApp",
        message: createError.message,
        details: createError.response?.data
      });
    }

    // Aguardar a instância se estabilizar
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ETAPA 3: Gerar QR Code
    console.log(`📱 ETAPA 3: Gerando QR Code para instância "${instanceName}"...`);
    
    // Tentar diferentes endpoints para obter QR Code
    const qrEndpoints = [
      `${baseUrl}/instance/connect/${instanceName}`,
      `${baseUrl}/qrcode/${instanceName}`,
      `${baseUrl}/instance/qrcode/${instanceName}`
    ];

    let qrCode = null;
    let lastError = null;

    for (const endpoint of qrEndpoints) {
      try {
        console.log(`🔍 Tentando endpoint: ${endpoint}`);
        
        const qrResponse = await axios.get(endpoint, { 
          headers,
          timeout: 10000 
        });

        console.log(`📊 Resposta QR (${qrResponse.status}):`, typeof qrResponse.data);

        // Verificar se recebeu HTML (erro)
        if (typeof qrResponse.data === 'string' && qrResponse.data.includes('<!doctype html>')) {
          console.log(`⚠️ Recebeu HTML em vez de QR Code de ${endpoint}`);
          continue;
        }

        // Extrair QR Code da resposta
        if (qrResponse.data?.qrcode) {
          qrCode = qrResponse.data.qrcode;
        } else if (qrResponse.data?.qrCode) {
          qrCode = qrResponse.data.qrCode;
        } else if (qrResponse.data?.code) {
          qrCode = qrResponse.data.code;
        } else if (qrResponse.data?.data?.qrcode) {
          qrCode = qrResponse.data.data.qrcode;
        } else if (typeof qrResponse.data === 'string' && qrResponse.data.includes('data:image/')) {
          qrCode = qrResponse.data;
        }

        if (qrCode) {
          console.log(`✅ QR Code obtido de ${endpoint}: ${qrCode.substring(0, 50)}...`);
          break;
        } else {
          console.log(`❌ Nenhum QR Code encontrado em ${endpoint}`);
          console.log(`📄 Dados recebidos:`, JSON.stringify(qrResponse.data));
        }

      } catch (qrError: any) {
        console.log(`❌ Erro no endpoint ${endpoint}:`, qrError.message);
        lastError = qrError;
      }
    }

    if (qrCode) {
      return res.status(200).json({
        success: true,
        qrCode: qrCode,
        message: "QR Code gerado com sucesso! Escaneie com seu WhatsApp para conectar.",
        instance: instanceName
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Falha ao obter QR Code",
        message: "Não foi possível gerar o QR Code após criar a instância",
        lastError: lastError?.message,
        instance: instanceName
      });
    }

  } catch (error: any) {
    console.error(`💥 Erro geral na geração do QR Code:`, error);
    
    return res.status(500).json({
      success: false,
      error: "Erro interno do servidor",
      message: error.message || "Erro desconhecido ao gerar QR Code"
    });
  }
}