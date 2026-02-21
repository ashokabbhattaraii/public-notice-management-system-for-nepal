'use client';

import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Copy, ThumbsUp, ThumbsDown, RotateCcw, Trash2 } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
}

interface RagQAProps {
  isWidget?: boolean;
}

export function RagQA({ isWidget = false }: RagQAProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content:
        'Hello! I\'m your AI document assistant. I can help you find information from our institutional documents. Ask me anything about scholarships, campus facilities, admission procedures, or other academic matters.',
      timestamp: new Date(),
      sources: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const mockResponses: Record<string, string> = {
        scholarship:
          'Based on our Financial Aid & Scholarships Guide, we offer merit-based scholarships ranging from Rs. 50,000 to Rs. 2,00,000 per year. Eligibility requires a CGPA of 8.0 or above with no disciplinary records. The application deadline for 2024-25 is April 10, 2024.',
        facilities:
          'According to the Campus Map & Facilities Guide, our institution offers a state-of-the-art library, computer labs, sports complex, hostel facilities, medical center, and a cafeteria. Most facilities are open 24/7 during academic sessions.',
        admission:
          'Our admission process is detailed in the Course Catalog. We offer various undergraduate and postgraduate programs. The general admission timeline is typically from May to July each year.',
        default:
          'I found relevant information in our documents. To get more specific details, please ask about scholarships, facilities, admissions, or course offerings.',
      };

      let response = mockResponses.default;
      const lowerInput = input.toLowerCase();

      if (lowerInput.includes('scholarship') || lowerInput.includes('aid'))
        response = mockResponses.scholarship;
      else if (
        lowerInput.includes('facility') ||
        lowerInput.includes('campus') ||
        lowerInput.includes('hostel')
      )
        response = mockResponses.facilities;
      else if (lowerInput.includes('admission') || lowerInput.includes('apply'))
        response = mockResponses.admission;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date(),
        sources: ['Financial Aid & Scholarships Guide', 'Student Handbook 2024'],
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const copyToClipboard = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        type: 'assistant',
        content:
          'Hello! I\'m your AI document assistant. I can help you find information from our institutional documents. Ask me anything about scholarships, campus facilities, admission procedures, or other academic matters.',
        timestamp: new Date(),
        sources: [],
      },
    ]);
  };

  const restartChat = () => {
    clearChat();
    setInput('');
  };

  return (
    <Card className="flex flex-col h-full">
      {/* Header with Actions */}
      {!isWidget && (
        <div className="flex items-center justify-between p-3 lg:p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground text-sm lg:text-base">Chat with Documents</h3>
          <div className="flex items-center gap-1 lg:gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={restartChat}
              className="h-7 lg:h-8 px-2 lg:px-3"
            >
              <RotateCcw className="w-3.5 h-3.5 lg:w-4 lg:h-4 lg:mr-1.5" />
              <span className="hidden lg:inline">Restart</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="h-7 lg:h-8 px-2 lg:px-3"
            >
              <Trash2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 lg:mr-1.5" />
              <span className="hidden lg:inline">Clear</span>
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-3 lg:p-4">
        <div className="space-y-3 lg:space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] lg:max-w-md xl:max-w-lg rounded-lg p-3 lg:p-4 overflow-hidden ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="text-sm leading-relaxed break-words overflow-wrap-anywhere">{message.content}</p>

                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                    <p className="text-xs opacity-75 font-medium mb-2">
                      Sources:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {message.sources.map((source, idx) => (
                        <Badge
                          key={idx}
                          variant={
                            message.type === 'user'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="text-xs break-words max-w-full"
                        >
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {message.type === 'assistant' && (
                  <div className="flex flex-wrap gap-1 lg:gap-2 mt-2 lg:mt-3 pt-2 lg:pt-3 border-t border-current border-opacity-20">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 lg:h-7 px-2 text-xs"
                      onClick={() =>
                        copyToClipboard(message.id, message.content)
                      }
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      <span className="hidden sm:inline">{copiedId === message.id ? 'Copied' : 'Copy'}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 lg:h-7 px-2"
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 lg:h-7 px-2"
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted text-foreground rounded-lg p-4">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-3 lg:p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 text-sm"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="icon"
            className="h-9 w-9 flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}
