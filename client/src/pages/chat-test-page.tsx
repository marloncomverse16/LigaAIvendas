import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const ChatTestPage = () => {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<any[]>([]);
  const [directContacts, setDirectContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [directLoading, setDirectLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, qrCode: '' });
  const [statusLoading, setStatusLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Verificar status da conexão
  const checkConnectionStatus = async () => {
    try {
      setStatusLoading(true);
      addLog('Verificando status da conexão...');
      
      const response = await apiRequest('GET', '/api/connections/status');
      const data = await response.json();
      
      setConnectionStatus(data);
      addLog(`Status da conexão: ${data.connected ? 'Conectado ✅' : 'Desconectado ❌'}`);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      addLog(`Erro ao verificar status: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao verificar status da conexão"
      });
    } finally {
      setStatusLoading(false);
    }
  };

  // Carregar contatos usando API padrão
  const loadContacts = async () => {
    try {
      setLoading(true);
      addLog('Carregando contatos via API padrão...');
      
      const response = await apiRequest('GET', '/api/chat/contacts');
      const data = await response.json();
      
      if (data.success) {
        setContacts(data.contacts || []);
        addLog(`Contatos carregados com sucesso: ${data.contacts?.length || 0} contatos encontrados`);
      } else {
        addLog(`Erro ao carregar contatos: ${data.message || 'Motivo desconhecido'}`);
        toast({
          variant: "destructive",
          title: "Erro",
          description: data.message || "Falha ao carregar contatos"
        });
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      addLog(`Erro ao carregar contatos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar contatos"
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar contatos usando API otimizada
  const loadDirectContacts = async () => {
    try {
      setDirectLoading(true);
      addLog('Carregando contatos via API otimizada...');
      
      const response = await apiRequest('GET', '/api/chat/direct-contacts');
      console.log("Resposta da API:", response);
      const data = await response.json();
      console.log("Dados recebidos:", data);
      
      if (data.success) {
        setDirectContacts(data.contacts || []);
        addLog(`Contatos diretos carregados: ${data.contacts?.length || 0} contatos encontrados`);
      } else {
        addLog(`Erro ao carregar contatos diretos: ${data.message || 'Motivo desconhecido'}`);
        toast({
          variant: "destructive",
          title: "Erro",
          description: data.message || "Falha ao carregar contatos diretos"
        });
      }
    } catch (error) {
      console.error('Erro ao carregar contatos diretos:', error);
      addLog(`Erro ao carregar contatos diretos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar contatos diretos"
      });
    } finally {
      setDirectLoading(false);
    }
  };

  // Função para adicionar logs
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Carregar status inicial
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Teste de API de Chat</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Status da Conexão</CardTitle>
            <CardDescription>Verifica se o WhatsApp está conectado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="font-semibold">
                Status: 
                <span className={connectionStatus.connected ? "text-green-500 ml-2" : "text-red-500 ml-2"}>
                  {connectionStatus.connected ? "Conectado ✅" : "Desconectado ❌"}
                </span>
              </p>
            </div>
            {connectionStatus.qrCode && !connectionStatus.connected && (
              <div className="mt-4">
                <p className="mb-2 font-medium">Escaneie o QR Code para conectar:</p>
                <img src={connectionStatus.qrCode} alt="QR Code" className="max-w-full h-auto border border-gray-200" />
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={checkConnectionStatus} disabled={statusLoading}>
              {statusLoading ? "Verificando..." : "Verificar Status"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logs</CardTitle>
            <CardDescription>Registros de operações e eventos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md h-[300px] overflow-y-auto font-mono text-sm">
              {logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => setLogs([])}>
              Limpar Logs
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Teste de API de Contatos</CardTitle>
            <CardDescription>Compare as duas implementações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">API Padrão</h3>
                <Button onClick={loadContacts} disabled={loading} className="mb-4 w-full">
                  {loading ? "Carregando..." : "Carregar Contatos Padrão"}
                </Button>
                
                <div className="overflow-y-auto h-[300px] border rounded-md p-3">
                  {contacts.length > 0 ? (
                    contacts.map((contact, index) => (
                      <div key={index} className="mb-3 p-2 border-b">
                        <p className="font-semibold">{contact.name || contact.pushname || 'Sem nome'}</p>
                        <p className="text-sm text-gray-600">{contact.phone || contact.id.split('@')[0]}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center mt-6">Nenhum contato carregado</p>
                  )}
                </div>
                <p className="mt-2 text-sm text-right">{contacts.length} contatos encontrados</p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3">API Otimizada</h3>
                <Button onClick={loadDirectContacts} disabled={directLoading} className="mb-4 w-full">
                  {directLoading ? "Carregando..." : "Carregar Contatos Otimizados"}
                </Button>
                
                <div className="overflow-y-auto h-[300px] border rounded-md p-3">
                  {directContacts.length > 0 ? (
                    directContacts.map((contact, index) => (
                      <div key={index} className="mb-3 p-2 border-b">
                        <p className="font-semibold">{contact.name || contact.pushname || 'Sem nome'}</p>
                        <p className="text-sm text-gray-600">{contact.phone || contact.id.split('@')[0]}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center mt-6">Nenhum contato carregado</p>
                  )}
                </div>
                <p className="mt-2 text-sm text-right">{directContacts.length} contatos encontrados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados Brutos da API</CardTitle>
            <CardDescription>Visualizar o formato completo de dados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Resposta API Padrão</h3>
                <div className="overflow-auto h-[200px] border rounded-md p-3 bg-gray-50 dark:bg-gray-900 font-mono text-xs">
                  {contacts.length > 0 ? (
                    <pre>{JSON.stringify(contacts[0], null, 2)}</pre>
                  ) : (
                    <p className="text-gray-500 text-center mt-6">Sem dados disponíveis</p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3">Resposta API Otimizada</h3>
                <div className="overflow-auto h-[200px] border rounded-md p-3 bg-gray-50 dark:bg-gray-900 font-mono text-xs">
                  {directContacts.length > 0 ? (
                    <pre>{JSON.stringify(directContacts[0], null, 2)}</pre>
                  ) : (
                    <p className="text-gray-500 text-center mt-6">Sem dados disponíveis</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatTestPage;