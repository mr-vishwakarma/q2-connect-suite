import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Mic, MicOff, Bot, User, Sparkles, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'database' | 'ai';
  timestamp: Date;
}

interface SmartChatbotProps {
  isAdmin?: boolean;
}

export function SmartChatbot({ isAdmin = false }: SmartChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const { user } = useAuth();
  const { selectedHostel } = useHostel();

  // Add welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: isAdmin
          ? `👋 Hello Admin! I'm your **Q2 Campus Hub Assistant**.\n\nI can help you with:\n• Student counts, room stats\n• Fee & complaint summaries\n• Management advice\n\nCurrently viewing: **${selectedHostel}**`
          : `👋 Hi there! I'm your **Q2 Campus Hub Assistant**.\n\nAsk me about:\n• Your fees, room, complaints\n• Leave request status\n• General hostel queries\n\nHow can I help?`,
        source: 'ai',
        timestamp: new Date(),
      }]);
    }
  }, [isOpen]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading || !user) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          message: userMsg.content,
          hostel: selectedHostel,
          isAdmin,
          userId: user.id,
        },
      });

      if (error) throw error;

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.error || 'Sorry, something went wrong.',
        source: data.source,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error: ${err.message || 'Could not reach the assistant. Please try again.'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, user, selectedHostel, isAdmin]);

  // Voice input
  const toggleVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="h-14 w-14 rounded-full shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/60 transition-all duration-300"
              size="icon"
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-4rem)] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Q2 Assistant</p>
                  <p className="text-[10px] text-muted-foreground">{selectedHostel} • {isAdmin ? 'Admin' : 'Student'}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
              <div className="space-y-3">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="h-3 w-3 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-secondary text-foreground rounded-bl-sm'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm prose-invert max-w-none [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0 [&_li]:m-0">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                      {msg.source && (
                        <div className="flex items-center gap-1 mt-1 opacity-60">
                          {msg.source === 'database' ? (
                            <Database className="h-2.5 w-2.5" />
                          ) : (
                            <Sparkles className="h-2.5 w-2.5" />
                          )}
                          <span className="text-[9px]">{msg.source === 'database' ? 'Live Data' : 'AI'}</span>
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-2 items-start"
                  >
                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Bot className="h-3 w-3 text-primary" />
                    </div>
                    <div className="bg-secondary rounded-xl px-4 py-3 rounded-bl-sm">
                      <div className="flex gap-1">
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border bg-secondary/30">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleVoice}
                  className={`h-9 w-9 rounded-full shrink-0 ${isListening ? 'bg-primary/20 text-primary animate-pulse' : ''}`}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  className="h-9 rounded-full text-sm bg-background border-border"
                  disabled={isLoading}
                />
                <Button
                  onClick={sendMessage}
                  size="icon"
                  className="h-9 w-9 rounded-full shrink-0"
                  disabled={!input.trim() || isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
