/**
 * Ferramenta para reorganizar os campos de configuração do WhatsApp Cloud API (Meta)
 * Este script corrige valores nos campos incorretos com base na análise do formato
 */
import { Request, Response } from "express";
import { pool } from "../db";

export async function fixMetaConfigFields(req: Request, res: Response) {
  console.log("[META-FIX] Iniciando correção dos campos de configuração da Meta API");
  
  const result = {
    success: false,
    message: "",
    before: {},
    after: {},
    errors: [] as string[]
  };
  
  try {
    // 1. Obter as configurações atuais - procurar em todas as configurações
    const configQuery = await pool.query(`
      SELECT 
        id,
        user_id,
        whatsapp_meta_token,
        whatsapp_meta_business_id,
        whatsapp_meta_api_version
      FROM settings
      ORDER BY id
    `);
    
    if (configQuery.rows.length === 0) {
      result.message = "Nenhuma configuração encontrada";
      return res.status(404).json(result);
    }
    
    // Armazenar problemas encontrados
    const problemsFound = [];
    const correctionsApplied = [];
    
    // Processar cada configuração
    for (const config of configQuery.rows) {
      const userId = config.user_id;
      console.log(`[META-FIX] Analisando configuração do usuário ${userId} (ID: ${config.id})`);
      
      // Extrair valores atuais
      const currentToken = config.whatsapp_meta_token || '';
      const currentBusinessId = config.whatsapp_meta_business_id || '';
      const currentApiVersion = config.whatsapp_meta_api_version || '';
      
      // Guardar configuração original
      result.before[config.id] = {
        userId,
        token: currentToken,
        tokenLength: currentToken.length,
        tokenPrefix: currentToken.substring(0, 5) + "...",
        businessId: currentBusinessId,
        apiVersion: currentApiVersion
      };
      
      // Análise dos valores atuais
      let correctedToken = currentToken;
      let correctedBusinessId = currentBusinessId;
      let correctedApiVersion = 'v18.0'; // valor padrão
      let needsCorrection = false;
      
      // Verificar se o token está no lugar certo
      if (!currentToken.startsWith('EAA') && currentToken.length < 50) {
        const problem = `Usuário ${userId}: Token inválido ou vazio`;
        console.log(`[META-FIX] ${problem}`);
        problemsFound.push(problem);
        
        // Verificar se o token pode estar em outro campo
        if (currentBusinessId.startsWith('EAA') && currentBusinessId.length > 50) {
          correctedToken = currentBusinessId;
          correctedBusinessId = '';
          needsCorrection = true;
          correctionsApplied.push(`Usuário ${userId}: Token encontrado no campo ID do Negócio`);
        } else if (currentApiVersion.startsWith('EAA') && currentApiVersion.length > 50) {
          correctedToken = currentApiVersion;
          correctedApiVersion = 'v18.0';
          needsCorrection = true;
          correctionsApplied.push(`Usuário ${userId}: Token encontrado no campo Versão da API`);
        }
      }
      
      // Verificar se o business ID está no lugar certo (deve ser numérico)
      if (correctedBusinessId === '' || isNaN(Number(correctedBusinessId))) {
        const problem = `Usuário ${userId}: ID do Negócio vazio ou inválido`;
        console.log(`[META-FIX] ${problem}`);
        problemsFound.push(problem);
        
        // Verificar se o business ID pode estar em outro campo
        if (currentToken.length > 0 && !currentToken.startsWith('EAA') && !isNaN(Number(currentToken))) {
          correctedBusinessId = currentToken;
          // Se o token já foi corrigido, não sobrescrever
          if (correctedToken === currentToken) {
            correctedToken = '';
          }
          needsCorrection = true;
          correctionsApplied.push(`Usuário ${userId}: ID do Negócio encontrado no campo Token`);
        } else if (currentApiVersion.length > 0 && !currentApiVersion.startsWith('v') && !isNaN(Number(currentApiVersion))) {
          correctedBusinessId = currentApiVersion;
          correctedApiVersion = 'v18.0';
          needsCorrection = true;
          correctionsApplied.push(`Usuário ${userId}: ID do Negócio encontrado no campo Versão da API`);
        }
      }
      
      // Verificar se a API version está no lugar certo
      if (!correctedApiVersion.startsWith('v')) {
        const problem = `Usuário ${userId}: Versão da API inválida`;
        console.log(`[META-FIX] ${problem}`);
        problemsFound.push(problem);
        correctedApiVersion = 'v18.0';
        needsCorrection = true;
        correctionsApplied.push(`Usuário ${userId}: Versão da API corrigida para v18.0`);
      }
      
      // Se encontramos um problema mas não conseguimos corrigir automaticamente
      if (correctedToken === '' || !correctedToken.startsWith('EAA')) {
        const problem = `Usuário ${userId}: Não foi possível encontrar um token válido`;
        console.log(`[META-FIX] ${problem}`);
        problemsFound.push(problem);
      }
      
      if (correctedBusinessId === '' || isNaN(Number(correctedBusinessId))) {
        const problem = `Usuário ${userId}: Não foi possível encontrar um ID de negócio válido`;
        console.log(`[META-FIX] ${problem}`);
        problemsFound.push(problem);
      }
      
      // Aplicar correções se necessário
      if (needsCorrection) {
        try {
          console.log(`[META-FIX] Aplicando correções para o usuário ${userId}`);
          
          await pool.query(`
            UPDATE settings
            SET 
              whatsapp_meta_token = $1,
              whatsapp_meta_business_id = $2,
              whatsapp_meta_api_version = $3
            WHERE id = $4
          `, [correctedToken, correctedBusinessId, correctedApiVersion, config.id]);
          
          console.log(`[META-FIX] Correções aplicadas com sucesso para o usuário ${userId}`);
          
          // Guardar configuração corrigida
          result.after[config.id] = {
            userId,
            token: correctedToken,
            tokenLength: correctedToken.length,
            tokenPrefix: correctedToken.substring(0, 5) + "...",
            businessId: correctedBusinessId,
            apiVersion: correctedApiVersion
          };
        } catch (error: any) {
          const errorMsg = `Erro ao aplicar correções para o usuário ${userId}: ${error.message}`;
          console.error(`[META-FIX] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      } else {
        console.log(`[META-FIX] Não foram necessárias correções para o usuário ${userId}`);
        // Guardar configuração (sem alterações)
        result.after[config.id] = result.before[config.id];
      }
    }
    
    // Preparar resposta
    result.success = result.errors.length === 0;
    result.message = correctionsApplied.length > 0 
      ? `${correctionsApplied.length} correções aplicadas em ${configQuery.rows.length} configurações`
      : "Nenhuma correção necessária";
    
    return res.status(200).json({
      ...result,
      problemsFound,
      correctionsApplied
    });
    
  } catch (error: any) {
    console.error("[META-FIX] Erro durante correção:", error);
    result.message = "Erro ao corrigir campos";
    result.errors.push(error.message);
    return res.status(500).json(result);
  }
}