/**
 * Endpoint de diagnóstico para a integração com Meta API
 * Este módulo faz uma verificação completa da configuração e conexão
 */
import { Request, Response } from "express";
import axios from "axios";
import { pool } from "../db";

export async function diagnoseMeta(req: Request, res: Response) {
  const diagnostic = {
    timestamp: new Date().toISOString(),
    status: "running",
    steps: [] as any[],
    configurations: [] as any[]
  };

  try {
    // Passo 1: Verificar schema da tabela settings
    diagnostic.steps.push({ 
      step: 1, 
      name: "Verificando schema da tabela settings", 
      status: "running"
    });

    try {
      const schemaResult = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'settings'
      `);
      
      // Verificar se as colunas esperadas existem
      const columns = schemaResult.rows.map(row => row.column_name);
      const requiredColumns = [
        'whatsapp_meta_token', 
        'whatsapp_meta_business_id', 
        'whatsapp_meta_api_version'
      ];
      
      const missingColumns = requiredColumns.filter(col => !columns.includes(col));
      
      if (missingColumns.length === 0) {
        diagnostic.steps[0].status = "success";
        diagnostic.steps[0].message = `Schema válido. Colunas verificadas: ${requiredColumns.join(', ')}`;
        diagnostic.steps[0].columns = columns;
      } else {
        diagnostic.steps[0].status = "failed";
        diagnostic.steps[0].message = `Colunas faltando: ${missingColumns.join(', ')}`;
        diagnostic.steps[0].availableColumns = columns;
        
        throw new Error(`Colunas necessárias não encontradas: ${missingColumns.join(', ')}`);
      }
    } catch (error: any) {
      diagnostic.steps[0].status = "error";
      diagnostic.steps[0].message = `Erro ao verificar schema: ${error.message}`;
      throw error;
    }

    // Passo 2: Buscar todas as configurações disponíveis
    diagnostic.steps.push({
      step: 2,
      name: "Buscando configurações de usuários",
      status: "running"
    });

    try {
      const configsResult = await pool.query(`
        SELECT 
          settings.id,
          settings.user_id,
          settings.whatsapp_meta_token,
          settings.whatsapp_meta_business_id,
          settings.whatsapp_meta_api_version
        FROM settings
        ORDER BY settings.user_id ASC
      `);
      
      const configs = configsResult.rows;
      
      diagnostic.steps[1].status = "success";
      diagnostic.steps[1].message = `${configs.length} configurações encontradas`;
      
      // Adicionar versões truncadas das configurações
      configs.forEach((config, index) => {
        diagnostic.configurations.push({
          id: config.id,
          userId: config.user_id,
          tokenInfo: config.whatsapp_meta_token ? {
            length: config.whatsapp_meta_token.length,
            prefix: config.whatsapp_meta_token.substring(0, 5) + "...",
            isLikelyToken: config.whatsapp_meta_token.length > 50 || config.whatsapp_meta_token.startsWith("EAA")
          } : "não definido",
          businessIdInfo: config.whatsapp_meta_business_id ? {
            length: config.whatsapp_meta_business_id.length,
            value: config.whatsapp_meta_business_id.length <= 20 ? config.whatsapp_meta_business_id : "muito longo para exibir",
            isLikelyBusinessId: !isNaN(Number(config.whatsapp_meta_business_id)) && config.whatsapp_meta_business_id.length < 30
          } : "não definido",
          apiVersionInfo: config.whatsapp_meta_api_version || "não definido"
        });
      });
      
    } catch (error: any) {
      diagnostic.steps[1].status = "error";
      diagnostic.steps[1].message = `Erro ao buscar configurações: ${error.message}`;
      throw error;
    }

    // Passo 3: Tentar uma requisição à API da Meta
    if (diagnostic.configurations.length > 0) {
      diagnostic.steps.push({
        step: 3,
        name: "Testando conexão com a API da Meta",
        status: "running"
      });
      
      try {
        // Encontrar a primeira configuração que parece válida
        const validConfigs = diagnostic.configurations.filter(
          config => 
            config.tokenInfo !== "não definido" && 
            config.tokenInfo.isLikelyToken && 
            config.businessIdInfo !== "não definido" && 
            config.businessIdInfo.isLikelyBusinessId
        );
        
        if (validConfigs.length === 0) {
          diagnostic.steps[2].status = "skipped";
          diagnostic.steps[2].message = "Nenhuma configuração válida encontrada para testar";
          throw new Error("Não há configurações válidas para testar a API");
        }
        
        // Usar a primeira configuração válida
        const config = validConfigs[0];
        diagnostic.steps[2].configUsed = config;
        
        // Extrair os valores reais do banco de dados
        const result = await pool.query(`
          SELECT 
            settings.whatsapp_meta_token,
            settings.whatsapp_meta_business_id,
            settings.whatsapp_meta_api_version
          FROM settings
          WHERE settings.id = $1
        `, [config.id]);
        
        if (result.rows.length === 0) {
          diagnostic.steps[2].status = "error";
          diagnostic.steps[2].message = "Configuração não encontrada";
          throw new Error("Configuração selecionada não foi encontrada");
        }
        
        const dbConfig = result.rows[0];
        const token = dbConfig.whatsapp_meta_token;
        const businessId = dbConfig.whatsapp_meta_business_id;
        const apiVersion = dbConfig.whatsapp_meta_api_version || "v18.0";
        
        // Verificar valores antes de fazer a requisição
        if (!token || token.length < 20) {
          diagnostic.steps[2].status = "error";
          diagnostic.steps[2].message = "Token de acesso muito curto ou inválido";
          throw new Error("Token de acesso inválido");
        }
        
        if (!businessId || isNaN(Number(businessId))) {
          diagnostic.steps[2].status = "error";
          diagnostic.steps[2].message = "ID do negócio não é numérico";
          throw new Error("ID do negócio inválido");
        }
        
        // Testar com o endpoint de negócio
        const url = `https://graph.facebook.com/${apiVersion}/${businessId}`;
        diagnostic.steps[2].testUrl = url;
        
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.status === 200) {
          diagnostic.steps[2].status = "success";
          diagnostic.steps[2].message = "Conexão bem sucedida com a API da Meta";
          diagnostic.steps[2].businessInfo = {
            id: response.data.id,
            name: response.data.name
          };
        } else {
          diagnostic.steps[2].status = "warning";
          diagnostic.steps[2].message = `Resposta inesperada: ${response.status}`;
          diagnostic.steps[2].response = response.data;
        }
      } catch (error: any) {
        diagnostic.steps[2].status = "error";
        diagnostic.steps[2].message = `Erro ao conectar com a API: ${error.message}`;
        diagnostic.steps[2].error = error.response?.data?.error || error.message;
      }
      
      // Passo 4: Tentar buscar templates
      diagnostic.steps.push({
        step: 4,
        name: "Testando busca de templates",
        status: "running"
      });
      
      try {
        // Reutilizar a mesma configuração do passo anterior
        const configId = diagnostic.steps[2].configUsed?.id;
        
        if (!configId) {
          diagnostic.steps[3].status = "skipped";
          diagnostic.steps[3].message = "Configuração não disponível do teste anterior";
          throw new Error("Não há configuração disponível para testar templates");
        }
        
        // Extrair os valores reais do banco de dados
        const result = await pool.query(`
          SELECT 
            settings.whatsapp_meta_token,
            settings.whatsapp_meta_business_id,
            settings.whatsapp_meta_api_version
          FROM settings
          WHERE settings.id = $1
        `, [configId]);
        
        if (result.rows.length === 0) {
          diagnostic.steps[3].status = "error";
          diagnostic.steps[3].message = "Configuração não encontrada";
          throw new Error("Configuração selecionada não foi encontrada");
        }
        
        const dbConfig = result.rows[0];
        const token = dbConfig.whatsapp_meta_token;
        const businessId = dbConfig.whatsapp_meta_business_id;
        const apiVersion = dbConfig.whatsapp_meta_api_version || "v18.0";
        
        // URL para buscar templates
        const url = `https://graph.facebook.com/${apiVersion}/${businessId}/message_templates`;
        diagnostic.steps[3].testUrl = url;
        
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          params: {
            limit: 20
          }
        });
        
        if (response.status === 200 && response.data && response.data.data) {
          const templates = response.data.data;
          diagnostic.steps[3].status = "success";
          diagnostic.steps[3].message = "Templates obtidos com sucesso";
          diagnostic.steps[3].totalTemplates = templates.length;
          diagnostic.steps[3].approvedTemplates = templates.filter((t: any) => t.status === "APPROVED").length;
          
          // Incluir os primeiros templates para referência
          diagnostic.steps[3].templates = templates.slice(0, 3).map((t: any) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            language: t.language
          }));
        } else {
          diagnostic.steps[3].status = "warning";
          diagnostic.steps[3].message = "Resposta inesperada ao buscar templates";
          diagnostic.steps[3].response = response.data;
        }
      } catch (error: any) {
        diagnostic.steps[3].status = "error";
        diagnostic.steps[3].message = `Erro ao buscar templates: ${error.message}`;
        diagnostic.steps[3].error = error.response?.data?.error || error.message;
      }
    }

    // Concluir diagnóstico
    diagnostic.status = "completed";
    return res.status(200).json(diagnostic);
  } catch (error: any) {
    diagnostic.status = "failed";
    diagnostic.error = error.message;
    return res.status(500).json(diagnostic);
  }
}