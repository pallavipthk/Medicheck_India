import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, User as UserIcon, Sparkles, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { apiAskAssistant } from '../api/client';
import { RegulatoryResult } from '../types';

interface AIAssistantPageProps {
  initialMedicineName?: string;
  initialResult?: RegulatoryResult | null;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  source?: string;
  timestamp: string;
}

export const AIAssistantPage: React.FC<AIAssistantPageProps> = ({
  initialMedicineName,
  initialResult,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [configNotice, setConfigNotice] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // If opened from a specific medicine result, trigger an initial explanation
    if (initialMedicineName && initialResult) {
      const welcomeMsg: ChatMessage = {
        id: 'msg-init-user',
        sender: 'user',
        text: `Can you explain the regulatory safety status of ${initialMedicineName}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([welcomeMsg]);
      handleSendQuery(welcomeMsg.text, initialMedicineName, initialResult);
    } else {
      // General greeting
      setMessages([
        {
          id: 'msg-0',
          sender: 'assistant',
          text: `Hello! I am your MediCheck India Assistant. I provide evidence-grounded explanations regarding CDSCO Gazette notifications, prohibited Fixed-Dose Combinations (FDCs), and pharmaceutical regulatory records. How can I assist you with medicine safety today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [initialMedicineName]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendQuery = async (
    queryText: string,
    medName?: string,
    evalResult?: RegulatoryResult | null
  ) => {
    if (!queryText.trim()) return;
    setLoading(true);

    try {
      const res = await apiAskAssistant({
        query: queryText,
        medicine_name: medName || initialMedicineName,
        medicine_id: evalResult?.product_details?.medicine_id,
      });

      if (res.configuration_notice) {
        setConfigNotice(res.configuration_notice);
      }
      setIsConfigured(res.is_configured);

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-bot-${Date.now()}`,
          sender: 'assistant',
          text: res.response,
          source: res.provider,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'assistant',
          text: 'Unable to connect to the assistant service. Please check your network connection.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-user-${Date.now()}`,
        sender: 'user',
        text: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    handleSendQuery(userText);
  };

  const quickPrompts = [
    'Why is Nimesulide + Paracetamol dispersible prohibited in India?',
    'What does Section 26A of the Drugs and Cosmetics Act mean?',
    'How does CDSCO evaluate Fixed-Dose Combinations (FDCs)?',
    'Is "No ban found in our data" the same as medically safe?',
  ];

  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={styles.botIcon}>
            <Bot size={24} color="#168C78" strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={styles.title}>AI Medicine Assistant</h1>
            <p style={styles.subtitle}>
              Evidence-based pharmaceutical intelligence powered by CDSCO Gazette records.
            </p>
          </div>
        </div>
      </div>

      {/* Honest Mode / Configuration Status Notice */}
      <div style={styles.modeNotice}>
        <Info size={18} color="var(--accent-teal)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.45 }}>
          <b>Engine Mode:</b> {isConfigured ? 'External LLM Active' : 'Verified Local CDSCO Intelligence Engine (No paid API key required)'}.
          {configNotice && <span> {configNotice}</span>}
        </div>
      </div>

      {/* Chat Display Area */}
      <div className="card" style={styles.chatCard}>
        <div style={styles.messagesList}>
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                style={{
                  ...styles.messageRow,
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                {!isUser && (
                  <div style={styles.avatarBot}>
                    <Bot size={16} color="#168C78" />
                  </div>
                )}
                <div
                  style={{
                    ...styles.messageBubble,
                    ...(isUser ? styles.bubbleUser : styles.bubbleBot),
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{msg.text}</div>
                  <div style={styles.msgFooter}>
                    {msg.source && <span style={styles.sourceTag}>{msg.source}</span>}
                    <span style={styles.timeTag}>{msg.timestamp}</span>
                  </div>
                </div>
                {isUser && (
                  <div style={styles.avatarUser}>
                    <UserIcon size={16} color="#FFFFFF" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div style={styles.loadingRow}>
              <div style={styles.avatarBot}>
                <Bot size={16} color="#168C78" />
              </div>
              <div style={styles.typingIndicator}>
                <span>Analyzing CDSCO Gazette records...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggested Queries */}
        <div style={styles.quickPromptSection}>
          <span style={styles.quickLabel}>Suggested Inquiries:</span>
          <div style={styles.quickPromptRow}>
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                style={styles.promptChip}
                onClick={() => {
                  setInput(p);
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleFormSubmit} style={styles.inputBar}>
          <input
            id="ai-query-input"
            type="text"
            placeholder="Ask about CDSCO prohibitions, ingredient safety, or Section 26A..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={styles.textInput}
            disabled={loading}
          />
          <button
            id="ai-send-btn"
            type="submit"
            className="btn btn-primary"
            style={styles.sendBtn}
            disabled={loading || !input.trim()}
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px 40px',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '18px',
  },
  botIcon: {
    width: '46px',
    height: '46px',
    borderRadius: '14px',
    backgroundColor: '#E5F5EF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '26px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    marginBottom: '3px',
  },
  subtitle: {
    fontSize: '14.5px',
    color: '#667580',
  },
  modeNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#F2FAF6',
    border: '1.5px solid #BCE3D5',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '20px',
  },
  chatCard: {
    display: 'flex',
    flexDirection: 'column',
    height: '680px',
    padding: '0',
    overflow: 'hidden',
  },
  messagesList: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    maxWidth: '85%',
  },
  avatarBot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-mint)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '4px',
  },
  avatarUser: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-teal)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '4px',
  },
  messageBubble: {
    padding: '14px 18px',
    borderRadius: '14px',
    fontSize: '14.5px',
    maxWidth: '100%',
  },
  bubbleBot: {
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    borderTopLeftRadius: '4px',
  },
  bubbleUser: {
    backgroundColor: 'var(--accent-teal)',
    color: '#FFFFFF',
    borderTopRightRadius: '4px',
  },
  msgFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '6px',
    fontSize: '11px',
    opacity: 0.75,
  },
  sourceTag: {
    fontWeight: 600,
  },
  timeTag: {},
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  typingIndicator: {
    padding: '10px 16px',
    backgroundColor: 'var(--surface-alt)',
    borderRadius: '12px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
  },
  quickPromptSection: {
    padding: '12px 20px',
    backgroundColor: 'var(--surface-alt)',
    borderTop: '1px solid var(--border-subtle)',
  },
  quickLabel: {
    display: 'block',
    fontSize: '11.5px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    marginBottom: '6px',
  },
  quickPromptRow: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  promptChip: {
    padding: '5px 12px',
    borderRadius: '9999px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-subtle)',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  inputBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--surface)',
  },
  textInput: {
    flex: 1,
    padding: '11px 16px',
    borderRadius: '10px',
    border: '1.5px solid var(--border-subtle)',
    outline: 'none',
    fontSize: '14.5px',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--surface-alt)',
  },
  sendBtn: {
    padding: '11px 20px',
  },
};
