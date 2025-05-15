/**
 * Módulo para importação de arquivos
 * Centraliza o código relacionado a importações CSV e Excel
 */
import { importCSVContent } from "./csvImporter";
import { IStorage } from "./storage";
import fs from "fs";
import xlsx from "xlsx";

/**
 * Processa a importação de um arquivo de prospecção
 * @param file O arquivo a ser processado
 * @param searchId ID da busca
 * @param storage Instância do armazenamento
 * @returns Resultado da importação
 */
export async function processProspectingFile(
  file: Express.Multer.File,
  searchId: number,
  storage: IStorage
): Promise<{ importedLeads: number; errorLeads: number; message: string }> {
  // Processar CSV
  if (file.mimetype.includes('csv') || file.originalname.endsWith('.csv')) {
    // Ler conteúdo do arquivo
    const fileContent = fs.readFileSync(file.path, 'utf8');
    
    if (fileContent.trim().length < 10) {
      throw new Error("Arquivo CSV vazio ou sem dados suficientes");
    }
    
    // Usar nosso módulo de importação otimizado
    return await importCSVContent(fileContent, searchId, storage);
  } 
  // Processar Excel
  else if (file.mimetype.includes('excel') || 
           file.mimetype.includes('spreadsheet') || 
           file.originalname.endsWith('.xlsx') || 
           file.originalname.endsWith('.xls')) {
    
    try {
      // Ler conteúdo do arquivo Excel
      console.log("Processando arquivo Excel:", file.originalname);
      
      // Converter Excel para formato CSV para usar nosso processador existente
      const workbook = xlsx.readFile(file.path, { type: 'buffer', codepage: 65001 }); // UTF-8
      const sheetName = workbook.SheetNames[0];
      
      // Extrair os dados diretamente como um array de objetos com nomes de colunas intactos
      const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { 
        raw: false,
        defval: ""
      });
      
      if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error("Arquivo Excel vazio ou sem dados suficientes");
      }
      
      console.log("Dados Excel processados (primeiras linhas): ", 
        JSON.stringify(rawData.slice(0, 2)).substring(0, 200) + "...");
      
      // Obter todas as chaves (nomes de colunas) do primeiro objeto
      const headers = Object.keys(rawData[0] as Record<string, any>);
      
      // Construir CSV manualmente
      const csvLines: string[] = [];
      
      // Adicionar cabeçalho
      csvLines.push(headers.join(','));
      
      // Adicionar linhas de dados
      for (const row of rawData as Record<string, any>[]) {
        const values = headers.map(header => {
          const value = row[header] || "";
          
          // Tratar valor: escapar aspas e adicionar aspas se tiver vírgula
          if (typeof value === 'string') {
            // Preservar o valor original sem substituição de caracteres especiais
            // Para evitar problemas com formatação de endereços
            const escaped = value.replace(/"/g, '""');
            return escaped.includes(',') ? `"${escaped}"` : escaped;
          }
          
          // Se for um número ou outro tipo, converter para string
          return String(value);
        });
        
        csvLines.push(values.join(','));
      }
      
      const csvContent = csvLines.join('\n');
      console.log("CSV gerado:", csvContent.substring(0, 200) + "...");
      
      if (!csvContent || csvContent.trim().length < 10) {
        throw new Error("Arquivo Excel vazio ou sem dados");
      }
      
      // Usar o mesmo processador de CSV com o conteúdo convertido do Excel
      return await importCSVContent(csvContent, searchId, storage);
    } catch (error) {
      console.error("Erro ao processar arquivo Excel:", error);
      throw new Error(`Erro ao processar arquivo Excel: ${error.message}`);
    }
  } else {
    // Formato não suportado
    throw new Error("Formato de arquivo não suportado. Use CSV ou Excel (.xlsx/.xls)");
  }
}