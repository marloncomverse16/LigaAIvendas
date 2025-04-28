import express, { Express, Request } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";

// Define storage options
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(import.meta.dirname, "../uploads");
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename to prevent overwrites
    const uniquePrefix = randomBytes(8).toString("hex");
    const fileExt = path.extname(file.originalname);
    cb(null, `${uniquePrefix}-${Date.now()}${fileExt}`);
  }
});

// Configure allowed file types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept images only
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Apenas arquivos de imagem são permitidos"));
  }
};

// Create multer upload instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  }
});

export function setupFileUpload(app: Express) {
  // Handle logo uploads
  app.post("/api/upload/logo", upload.single("logo"), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
      }
      
      // Construct the URL for the uploaded file
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const relativePath = `/uploads/${req.file.filename}`;
      const fileUrl = `${baseUrl}${relativePath}`;
      
      res.json({
        success: true,
        logoUrl: fileUrl,
        filename: req.file.filename
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: "Erro ao fazer upload do arquivo"
      });
    }
  });
  
  // Serve uploaded files statically
  app.use("/uploads", (req, res, next) => {
    // Express middleware to ensure uploads are only accessible to authenticated users
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    next();
  }, express.static(path.join(import.meta.dirname, "../uploads")));
  
  // Error handler for upload errors
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false, 
          message: "Arquivo muito grande. O tamanho máximo é 2MB"
        });
      }
      return res.status(400).json({ 
        success: false,
        message: err.message 
      });
    }
    
    next(err);
  });
}
