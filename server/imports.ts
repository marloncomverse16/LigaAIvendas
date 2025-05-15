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
      
      // Extrair os dados como objeto JS direto, mantendo os caracteres especiais
      const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { 
        raw: false, 
        defval: "",
        header: 1 // Usar cabeçalhos da primeira linha
      });
      
      if (!Array.isArray(rawData) || rawData.length < 2) {
        throw new Error("Arquivo Excel vazio ou sem dados suficientes");
      }
      
      console.log("Dados Excel processados (primeiras linhas): ", 
        JSON.stringify(rawData.slice(0, 3)).substring(0, 200) + "...");
      
      // Obter cabeçalhos (primeira linha)
      const headers = rawData[0] as string[];
      
      // Construir CSV manualmente
      const csvLines: string[] = [];
      
      // Adicionar cabeçalho
      csvLines.push(headers.join(','));
      
      // Adicionar linhas de dados (pular a primeira linha que é o cabeçalho)
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        
        // Garantir que temos o mesmo número de colunas que os cabeçalhos
        const values = headers.map((_, index) => {
          const value = row[index] || "";
          
          // Tratar valor: escapar aspas e adicionar aspas se tiver vírgula
          if (typeof value === 'string') {
            // Corrigir caracteres especiais específicos que podem vir mal formatados do Excel
            let cleanValue = value
              .replace(/�/g, 'ç') // Corrigir ç
              .replace(/[õóòô]/g, 'o') // Normalizar variações de 'o'
              .replace(/[ãáà]/g, 'a') // Normalizar variações de 'a'
              .replace(/[éèê]/g, 'e') // Normalizar variações de 'e'
              .replace(/[íìî]/g, 'i') // Normalizar variações de 'i'
              .replace(/[úùû]/g, 'u'); // Normalizar variações de 'u'
              
            const escaped = cleanValue.replace(/"/g, '""');
            return escaped.includes(',') ? `"${escaped}"` : escaped;
          }
          return value;
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