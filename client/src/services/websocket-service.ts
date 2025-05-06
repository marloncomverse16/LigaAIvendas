import { toast } from "@/hooks/use-toast";

interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
}

type MessageHandler = (message: WebSocketMessage) => void;

export class WebSocketService {
  private socket: WebSocket | null = null;
  private isConnecting: boolean = false;
  private reconnectTimer: number | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private userId: number | null = null;
  
  // Singleton
  private static instance: WebSocketService;
  
  private constructor() {
    // Privado para singleton
  }
  
  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }
  
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  public async connect(userId: number): Promise<boolean> {
    if (this.isConnected() || this.isConnecting) {
      return true;
    }
    
    this.isConnecting = true;
    this.userId = userId;
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;
      
      this.socket = new WebSocket(wsUrl);
      
      return await new Promise<boolean>((resolve) => {
        if (!this.socket) {
          this.isConnecting = false;
          resolve(false);
          return;
        }
        
        this.socket.onopen = () => {
          console.log('WebSocket conectado');
          this.isConnecting = false;
          
          // Autenticar imediatamente após conexão
          this.authenticate(userId);
          resolve(true);
        };
        
        this.socket.onclose = (event) => {
          console.log(`WebSocket desconectado: ${event.code} ${event.reason}`);
          this.socket = null;
          this.isConnecting = false;
          
          // Tentar reconectar em 2 segundos
          if (this.reconnectTimer === null) {
            this.reconnectTimer = window.setTimeout(() => {
              this.reconnectTimer = null;
              if (this.userId) {
                this.connect(this.userId);
              }
            }, 2000);
          }
          
          resolve(false);
        };
        
        this.socket.onerror = (error) => {
          console.error('Erro no WebSocket:', error);
          toast({
            title: "Erro de conexão",
            description: "Não foi possível conectar ao servidor. Tentando novamente...",
            variant: "destructive",
          });
        };
        
        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage;
            
            // Executar handlers registrados para este tipo de mensagem
            if (this.messageHandlers.has(message.type)) {
              this.messageHandlers.get(message.type)?.forEach(handler => {
                try {
                  handler(message);
                } catch (error) {
                  console.error(`Erro ao processar mensagem ${message.type}:`, error);
                }
              });
            }
            
            // Handlers para erros
            if (message.error) {
              console.error('Erro recebido via WebSocket:', message.error);
              toast({
                title: "Erro",
                description: message.error,
                variant: "destructive",
              });
            }
          } catch (error) {
            console.error('Erro ao processar mensagem WebSocket:', error);
          }
        };
      });
    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
      this.isConnecting = false;
      return false;
    }
  }
  
  public authenticate(userId: number): void {
    if (!this.isConnected()) {
      this.connect(userId);
      return;
    }
    
    // Usar userId como token para simplificar
    // No futuro, devemos implementar um sistema de token JWT
    this.sendMessage({
      type: 'authenticate',
      userId,
      token: userId.toString(), // Usar o ID do usuário como token temporário
    });
  }
  
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  public sendMessage(message: any): void {
    if (!this.isConnected()) {
      console.error('Tentativa de enviar mensagem com WebSocket desconectado');
      toast({
        title: "Erro de conexão",
        description: "Desconectado do servidor. Tentando reconectar...",
        variant: "destructive",
      });
      
      if (this.userId) {
        this.connect(this.userId);
      }
      return;
    }
    
    try {
      this.socket?.send(JSON.stringify(message));
    } catch (error) {
      console.error('Erro ao enviar mensagem WebSocket:', error);
    }
  }
  
  public on(messageType: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }
    
    this.messageHandlers.get(messageType)?.add(handler);
    
    // Retorna função para remover o handler
    return () => {
      this.messageHandlers.get(messageType)?.delete(handler);
    };
  }
  
  // Métodos de alto nível para operações comuns
  
  public getWhatsAppStatus(callback: (status: any) => void): void {
    const removeHandler = this.on('connection_status', (message) => {
      callback(message.data);
    });
    
    this.sendMessage({
      type: 'connect_evolution',
    });
    
    // Remover handler após 10 segundos (timeout)
    setTimeout(removeHandler, 10000);
  }
  
  public createInstance(callback?: (result: any) => void): void {
    const removeHandler = callback ? this.on('instance_created', (message) => {
      callback(message.data);
      removeHandler();
    }) : () => {};
    
    this.sendMessage({
      type: 'create_evolution_instance',
    });
    
    // Remover handler após 10 segundos se tiver callback
    if (callback) {
      setTimeout(removeHandler, 10000);
    }
  }
  
  public getQRCode(callback: (qrCode: string) => void): void {
    // Primeiro criar a instância, depois obter o QR code
    this.createInstance(() => {
      console.log("Instância criada, obtendo QR code...");
      
      const removeHandler = this.on('qr_code', (message) => {
        if (message.data?.qrCode) {
          callback(message.data.qrCode);
        }
      });
      
      this.sendMessage({
        type: 'connect_evolution',
      });
      
      // Remover handler após 60 segundos (tempo para escanear QR)
      setTimeout(removeHandler, 60000);
    });
  }
  
  public getContacts(callback: (contacts: any[]) => void): void {
    const removeHandler = this.on('contacts', (message) => {
      if (message.data?.contacts) {
        callback(message.data.contacts);
      }
    });
    
    this.sendMessage({
      type: 'get_contacts',
    });
    
    // Remover handler após 10 segundos (timeout)
    setTimeout(removeHandler, 10000);
  }
  
  public getMessages(contactId: number, callback: (messages: any[]) => void): void {
    const removeHandler = this.on('messages', (message) => {
      if (message.data?.contactId === contactId && message.data?.messages) {
        callback(message.data.messages);
      }
    });
    
    this.sendMessage({
      type: 'get_messages',
      contactId,
    });
    
    // Remover handler após 10 segundos (timeout)
    setTimeout(removeHandler, 10000);
  }
  
  public sendTextMessage(contactId: number, content: string, callback?: (result: any) => void): void {
    const removeHandler = callback ? this.on('message_result', (message) => {
      callback(message.data);
      
      // Auto-remover após receber
      removeHandler();
    }) : () => {};
    
    this.sendMessage({
      type: 'send_message',
      contactId,
      content,
    });
    
    // Se tiver callback, remover handler após 10 segundos (timeout)
    if (callback) {
      setTimeout(removeHandler, 10000);
    }
  }
}

export default WebSocketService.getInstance();