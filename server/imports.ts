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
      
      // Ler arquivo Excel diretamente como conteúdo binário
      const fileContent = fs.readFileSync(file.path);
      
      // Converter para formato de planilha usando xlsx
      const workbook = xlsx.read(fileContent, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      
      // Criar uma nova planilha para ter controle total sobre o processo
      const newWorkbook = xlsx.utils.book_new();
      const worksheet = workbook.Sheets[sheetName];
      
      // Extrair dados como uma matriz (formato mais bruto para melhor controle)
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false });
      
      if (!data || data.length === 0) {
        throw new Error("Arquivo Excel vazio ou sem dados");
      }
      
      // Criar um novo CSV manualmente, usando ponto e vírgula como separador
      // para evitar problemas com vírgulas nos endereços
      const lines = data.map((row: any[]) => {
        return row.map((cell: any) => {
          // Garantir que células são strings
          let value = String(cell || "");
          // Escapar as aspas duplicando-as
          value = value.replace(/"/g, '""');
          // Envolver em aspas se contiver ponto e vírgula
          return value.includes(';') ? `"${value}"` : value;
        }).join(';');
      });
      
      // Criar o conteúdo CSV
      const csvContent = lines.join('\n');
      
      console.log("CSV gerado do Excel (primeiras linhas):", 
        csvContent.substring(0, 200) + "...");
      
      // Processar o CSV usando a função existente
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