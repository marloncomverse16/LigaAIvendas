import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

// Diretório base para armazenamento de arquivos
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'ai-agent');

// Garantir que o diretório existe
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    // Diretório já existe
  }
}

// Tipos de arquivo suportados
export const SUPPORTED_FILE_TYPES = {
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.odf.spreadsheet': 'excel'
};

export interface FileStorageResult {
  filePath: string;
  fileName: string;
  fileFormat: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Salva um arquivo no sistema de arquivos
 */
export async function saveFile(
  buffer: Buffer,
  originalFileName: string,
  mimeType: string,
  userId: number
): Promise<FileStorageResult> {
  await ensureUploadDir();
  
  // Determinar formato do arquivo
  const fileFormat = SUPPORTED_FILE_TYPES[mimeType as keyof typeof SUPPORTED_FILE_TYPES];
  if (!fileFormat) {
    throw new Error(`Tipo de arquivo não suportado: ${mimeType}`);
  }
  
  // Gerar nome único para o arquivo
  const timestamp = Date.now();
  const extension = path.extname(originalFileName);
  const baseName = path.basename(originalFileName, extension);
  const uniqueFileName = `${userId}_${timestamp}_${baseName}${extension}`;
  const filePath = path.join(UPLOAD_DIR, uniqueFileName);
  
  // Salvar arquivo
  await writeFile(filePath, buffer);
  
  return {
    filePath: uniqueFileName, // Salvar apenas o nome do arquivo, não o caminho completo
    fileName: originalFileName,
    fileFormat,
    fileSize: buffer.length,
    mimeType
  };
}

/**
 * Lê um arquivo do sistema de arquivos
 */
export async function readFileFromStorage(fileName: string): Promise<Buffer> {
  const filePath = path.join(UPLOAD_DIR, fileName);
  return await readFile(filePath);
}

/**
 * Remove um arquivo do sistema de arquivos
 */
export async function deleteFile(fileName: string): Promise<void> {
  try {
    const filePath = path.join(UPLOAD_DIR, fileName);
    await unlink(filePath);
  } catch (error) {
    // Arquivo pode não existir, ignorar erro
    console.warn(`Erro ao deletar arquivo ${fileName}:`, error);
  }
}

/**
 * Verifica se um arquivo existe
 */
export function fileExists(fileName: string): boolean {
  try {
    const filePath = path.join(UPLOAD_DIR, fileName);
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}