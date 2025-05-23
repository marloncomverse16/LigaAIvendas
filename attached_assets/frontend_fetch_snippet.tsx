// Placeholder para client/src/pages/chat-otimizado.tsx - Ajuste da Busca de Mensagens

// ... outras importações e código ...

const fetchMessages = async (chatId: string) => {
  try {
    // Modificado para usar o novo endpoint unificado
    const response = await fetch(`/api/chat/messages/${chatId}`); // <-- ALTERAÇÃO AQUI (linha ~286 original)
    if (!response.ok) {
      throw new Error("Erro ao buscar mensagens");
    }
    const messages = await response.json();

    // ATENÇÃO: Ajustar o processamento das mensagens conforme a nova estrutura
    // A resposta agora é um array de objetos com: { id, message, type, timestamp, direction, status? }
    // Exemplo: Mapear para o formato que o componente de chat espera
    const formattedMessages = messages.map(msg => ({
      _id: msg.id.toString(), // Usar um ID único
      text: msg.message,
      createdAt: new Date(msg.timestamp),
      user: {
        _id: msg.direction === 'outbound' ? 1 : 2, // Diferenciar remetente (1 = app, 2 = contato)
        // name: msg.direction === 'outbound' ? 'Você' : 'Contato' // Opcional
      },
      // Adicionar outros campos necessários pelo componente de chat (image, video, etc.)
      // Exemplo: Verificar msg.type para diferentes tipos de mensagem
      // status: msg.status // Se precisar exibir o status da mensagem enviada
    }));

    // Atualizar o estado do componente com as mensagens formatadas
    // setMessages(formattedMessages.reverse()); // Exemplo: react-native-gifted-chat espera ordem reversa
    setMessages(formattedMessages); // Ou a ordem direta, dependendo do componente

  } catch (error) {
    console.error("Falha ao carregar mensagens:", error);
    // Tratar erro (ex: mostrar notificação para o usuário)
  }
};

// ... restante do código do componente ...

