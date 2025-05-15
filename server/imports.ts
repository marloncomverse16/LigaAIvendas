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
      // Importar o módulo específico para Excel (para processar corretamente o formato)
      const { importExcelFile } = await import('./excelImporter');
      
      // Usar o processador de Excel otimizado para lidar com campos especiais
      console.log("Processando arquivo Excel com processador dedicado:", file.originalname);
      
      return await importExcelFile(file.path, searchId, storage);
    } catch (error: any) {
      console.error("Erro ao processar arquivo Excel:", error);
      throw new Error(`Erro ao processar arquivo Excel: ${error.message}`);
    }
  } else {
    // Formato não suportado
    throw new Error("Formato de arquivo não suportado. Use CSV ou Excel (.xlsx/.xls)");
  }
}