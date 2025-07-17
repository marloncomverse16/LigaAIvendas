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

  // Handle profile image uploads
  app.post("/api/upload/profile-image", upload.single("image"), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
      }
      
      const user = req.user as any;
      
      // Construct the URL for the uploaded file
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const relativePath = `/uploads/${req.file.filename}`;
      const imageUrl = `${baseUrl}${relativePath}`;
      
      // Update user profile with new image URL
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      await db.update(users)
        .set({ profileImage: imageUrl })
        .where(eq(users.id, user.id));
      
      res.json({
        success: true,
        imageUrl: imageUrl,
        filename: req.file.filename
      });
    } catch (error) {
      console.error("Erro ao fazer upload da imagem de perfil:", error);
      res.status(500).json({ 
        success: false,
        message: "Erro ao fazer upload da imagem"
      });
    }
  });

  // Handle profile image removal
  app.delete("/api/upload/profile-image", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    try {
      const user = req.user as any;
      
      // Get current profile image to delete file
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const currentUser = await db.select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      
      if (currentUser.length > 0 && currentUser[0].profileImage) {
        // Extract filename from URL and delete file
        const imageUrl = currentUser[0].profileImage;
        const filename = imageUrl.split('/uploads/')[1];
        
        if (filename) {
          const filePath = path.join(import.meta.dirname, "../uploads", filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
      
      // Remove image URL from database
      await db.update(users)
        .set({ profileImage: null })
        .where(eq(users.id, user.id));
      
      res.json({
        success: true,
        message: "Imagem removida com sucesso"
      });
    } catch (error) {
      console.error("Erro ao remover imagem de perfil:", error);
      res.status(500).json({ 
        success: false,
        message: "Erro ao remover imagem"
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
