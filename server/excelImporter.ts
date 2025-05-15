/**
 * Módulo específico para importação de arquivos Excel (.xlsx)
 * Converte Excel diretamente para os objetos necessários sem passar pelo formato CSV
 */
import { IStorage } from "./storage";
import xlsx from "xlsx";
import fs from "fs";
import { findColumnIndex, normalizeString, formatPhoneNumber } from "./csvImporter";

/**
 * Importa dados diretamente de um arquivo Excel para o sistema de prospecção
 * Implementação otimizada para tratar corretamente caracteres especiais e formatação
 * 
 * @param filePath Caminho do arquivo Excel no sistema
 * @param searchId ID da busca de prospecção
 * @param storage Instância do armazenamento
 * @returns Dados processados e número de leads importados
 */
export async function importExcelFile(
  filePath: string,
  searchId: number,
  storage: IStorage
): Promise<{
  importedLeads: number;
  errorLeads: number;
  message: string;
}> {
  try {
    // Ler conteúdo do arquivo Excel com codificação UTF-8
    console.log("Processando arquivo Excel diretamente:", filePath);
    
    // Usar opções específicas para Excel para garantir leitura correta
    const workbook = xlsx.readFile(filePath, { 
      type: 'file',
      codepage: 65001, // UTF-8
      cellDates: true,
      dateNF: 'yyyy-mm-dd' 
    });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      throw new Error("Planilha vazia ou inválida");
    }
    
    // Extrair os dados como objeto JS diretamente
    const rawData = xlsx.utils.sheet_to_json<string[]>(worksheet, { 
      header: 1, // Usar cabeçalhos da primeira linha
      defval: "", // Valor padrão para células vazias
      blankrows: false // Ignorar linhas vazias
    });
    
    if (!Array.isArray(rawData) || rawData.length < 2) {
      throw new Error("Arquivo Excel vazio ou sem dados suficientes");
    }
    
    // Depuração: Mostrar primeiras linhas dos dados brutos
    console.log("Dados Excel processados (primeiras linhas):", 
      JSON.stringify(rawData.slice(0, 3)));
    
    // Obter cabeçalhos da primeira linha
    const headers = rawData[0] as string[];
    
    // Índices das colunas importantes
    const nameColIndex = findColumnIndex(headers, "name");
    const emailColIndex = findColumnIndex(headers, "email");
    const phoneColIndex = findColumnIndex(headers, "phone");
    const addressColIndex = findColumnIndex(headers, "address");
    const cityColIndex = findColumnIndex(headers, "cidade");
    const stateColIndex = findColumnIndex(headers, "estado");
    const siteColIndex = findColumnIndex(headers, "site");
    
    console.log("Índices das colunas:", { 
      name: nameColIndex, 
      email: emailColIndex, 
      phone: phoneColIndex,
      address: addressColIndex,
      city: cityColIndex,
      state: stateColIndex,
      site: siteColIndex
    });
    
    // Se não encontrou colunas importantes, tentar usar cabeçalhos originais
    const originalHeaders = headers.map(h => h.toString().toLowerCase().trim());
    console.log("Cabeçalhos originais:", originalHeaders);
    
    // Processar linhas de dados (pular a primeira linha que é o cabeçalho)
    const results = [];
    let validCount = 0;
    let duplicateCount = 0;
    let totalCount = 0;
    
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      if (!row || !Array.isArray(row) || row.every(cell => !cell)) continue;
      totalCount++;
      
      try {
        // Extrair os dados da linha atual
        let name = nameColIndex >= 0 ? (row[nameColIndex] || "").toString() : "";
        let email = emailColIndex >= 0 ? (row[emailColIndex] || "").toString() : "";
        let phone = phoneColIndex >= 0 ? (row[phoneColIndex] || "").toString() : "";
        let address = addressColIndex >= 0 ? (row[addressColIndex] || "").toString() : "";
        let cidade = cityColIndex >= 0 ? (row[cityColIndex] || "").toString() : "";
        let estado = stateColIndex >= 0 ? (row[stateColIndex] || "").toString() : "";
        let site = siteColIndex >= 0 ? (row[siteColIndex] || "").toString() : "";
        
        // Aplicar limpeza de strings
        name = normalizeString(name);
        email = normalizeString(email);
        
        // Formatar número de telefone para o padrão WhatsApp
        if (phone) {
          phone = formatPhoneNumber(phone.toString());
        }
        
        // Evitar endereços inválidos/malformatados do Excel
        if (address) {
          address = address.toString()
            .replace(/[^\w\s,\.\-\/áàâãéèêíìóòôõúùüçÁÀÂÃÉÈÊÍÌÓÒÔÕÚÙÜÇ]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
        
        // Preparar o objeto no formato esperado por createProspectingResult
        const leadData = {
          searchId,
          name,
          email,
          phone,
          address,
          type: "excel-import",
          // Adicionar os campos extra como parte de um objeto com propriedades adicionais
          cidade,
          estado,
          site
        };
        
        // Verificar por duplicação
        const existingLead = await storage.getLeadBySearchAndPhone(searchId, phone);
        if (existingLead) {
          duplicateCount++;
          continue;
        }
        
        // Criar o lead
        await storage.createProspectingResult(leadData);
        validCount++;
        results.push(leadData);
      } catch (rowError: any) {
        console.error(`Erro ao processar linha ${i}:`, rowError);
      }
    }
    
    console.log(`Processamento Excel concluído: ${validCount} leads válidos, ${duplicateCount} duplicados.`);
    
    return {
      importedLeads: validCount, 
      errorLeads: totalCount - validCount,
      message: `Importação concluída: ${validCount} leads importados, ${duplicateCount} duplicados, ${totalCount - validCount} com erro.`
    };
  } catch (error: any) {
    console.error("Erro ao processar arquivo Excel:", error);
    throw new Error(`Erro ao processar arquivo Excel: ${error.message}`);
  }
}