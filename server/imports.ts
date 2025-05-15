/**
 * Módulo para importação de arquivos
 * Centraliza o código relacionado a importações CSV e Excel
 */
import { importCSVContent } from "./csvImporter";
import { IStorage } from "./storage";
import fs from "fs";
import * as xlsx from "xlsx";

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
      const workbook = xlsx.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const csvContent = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      
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