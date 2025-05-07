import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "liguria-dashboard-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === 'production'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password'
    }, async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        
        // Verificar se o usuário existe e a senha está correta
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Email ou senha inválidos" });
        }
        
        // Verificar se o usuário está ativo
        if (user.active === false) {
          return done(null, false, { message: "Usuário desativado. Entre em contato com o administrador." });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      
      // Se o usuário não existe mais ou está desativado, não permitir o login
      if (!user || user.active === false) {
        return done(null, false);
      }
      
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, username, password, name } = req.body;
      
      // Validate required fields
      if (!email || !username || !password) {
        return res.status(400).json({ message: "Email, nome de usuário e senha são obrigatórios" });
      }
      
      // Check if email already exists
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email já está em uso" });
      }
      
      // Check if username already exists
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Nome de usuário já está em uso" });
      }
      
      // Create user with hashed password
      const user = await storage.createUser({
        username,
        email,
        password: await hashPassword(password),
        name: name || null,
        company: null,
        phone: null,
        bio: null
      });
      
      // Create default settings for the user
      await storage.createSettings({
        userId: user.id,
        logoUrl: null,
        primaryColor: "#047857",
        secondaryColor: "#4f46e5",
        darkMode: false
      });
      
      // Atribuir automaticamente a um servidor com capacidade disponível
      try {
        const bestServer = await storage.getServerWithLeastUsers(true);
        if (bestServer) {
          console.log(`Atribuindo usuário ${user.id} ao servidor ${bestServer.id} (${bestServer.name}) automaticamente`);
          
          // Associar usuário ao servidor
          await storage.addUserServer(user.id, bestServer.id);
          
          // Definir como servidor atual do usuário
          await storage.updateUserServerId(user.id, bestServer.id);
        }
      } catch (error) {
        console.error("Erro ao atribuir servidor automaticamente:", error);
        // Não impedir o registro se houver erro na atribuição automática
      }
      
      // Log in the user
      req.login(user, (err) => {
        if (err) return next(err);
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Email ou senha inválidos" });
      
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Remove password from response
    const { password, ...userWithoutPassword } = req.user as SelectUser;
    res.json(userWithoutPassword);
  });
}
