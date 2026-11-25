import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Mic, MicOff, RotateCcw, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { useChatBot } from '../../hooks/useChatBot';
import './ChatBotWidget.css';

// 18 deterministic constellation star coordinates inside the glassmorphic window
const CONSTELLATION_STARS = [
  { top: '8%', left: '12%', delay: '0s' },
  { top: '14%', left: '78%', delay: '0.4s' },
  { top: '21%', left: '34%', delay: '1.1s' },
  { top: '26%', left: '88%', delay: '0.7s' },
  { top: '33%', left: '18%', delay: '1.6s' },
  { top: '39%', left: '62%', delay: '0.2s' },
  { top: '45%', left: '8%', delay: '2.1s' },
  { top: '49%', left: '84%', delay: '1.3s' },
  { top: '54%', left: '46%', delay: '0.9s' },
  { top: '61%', left: '22%', delay: '1.8s' },
  { top: '66%', left: '73%', delay: '0.5s' },
  { top: '71%', left: '14%', delay: '2.4s' },
  { top: '75%', left: '54%', delay: '1.2s' },
  { top: '79%', left: '89%', delay: '0.3s' },
  { top: '84%', left: '31%', delay: '1.7s' },
  { top: '88%', left: '67%', delay: '0.8s' },
  { top: '92%', left: '19%', delay: '2.0s' },
  { top: '95%', left: '81%', delay: '1.4s' },
];

export const VoiceWave = () => (
  <span className="lcb-voice-wave" aria-hidden="true">
    <span className="lcb-voice-bar" />
    <span className="lcb-voice-bar" />
    <span className="lcb-voice-bar" />
    <span className="lcb-voice-bar" />
    <span className="lcb-voice-bar" />
  </span>
);

/**
 * Markdown-lite parser supporting **bold** and [Label](/path) links
 */
function renderFormattedLine(lineText, onLinkNavigate) {
  const tokenRegex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = lineText.split(tokenRegex);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="lcb-bold-highlight">
          {part.slice(2, -2)}
        </strong>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      return (
        <button key={idx} type="button" onClick={() => onLinkNavigate(href)} className="lcb-inline-link">
          <span>{label}</span>
          <span aria-hidden="true">↗</span>
        </button>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderMessageBody(text, onLinkNavigate) {
  const lines = (text || '').split('\n');
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={i} className="h-2" />;
    }
    return (
      <div key={i} className="leading-relaxed">
        {renderFormattedLine(line, onLinkNavigate)}
      </div>
    );
  });
}

export const ChatBotWidget = ({ currentPathname, onNavigatePath, onOpenDemoModal }) => {
  const [voiceMuted, setVoiceMuted] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [trackedPathname, setTrackedPathname] = useState(() => {
    if (typeof window !== 'undefined' && window.location?.pathname) {
      return window.location.pathname;
    }
    return '/';
  });
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleRouteChange = (e) => {
      const nextPath = e?.detail?.pathname || window.location?.pathname || '/';
      setTrackedPathname(nextPath);
    };
    window.addEventListener('sombill-route-change', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('sombill-route-change', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  // Determine active path for page-aware chips
  const resolvedPathname = useMemo(() => {
    return currentPathname || trackedPathname || '/';
  }, [currentPathname, trackedPathname]);

  // Text-to-Speech (TTS) readback when unmuted
  const speakBotReply = useCallback(
    (rawText) => {
      if (voiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const cleanText = (rawText || '')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/[•🚀🍽️🏨💳💰📋🆓🖥️📞📍⚡👋✨📊📦]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.04;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore TTS errors on restricted browsers
      }
    },
    [voiceMuted],
  );

  const {
    isOpen,
    setIsOpen,
    toggleOpen,
    messages,
    inputValue,
    setInputValue,
    isThinking,
    unreadCount,
    activeChips,
    sendMessage,
    clearChat,
  } = useChatBot({
    currentPathname: resolvedPathname,
    onBotReply: speakBotReply,
  });

  // Allow any button (e.g., FAQ Support Callout "Ask SomBill AI") to open the chatbot window
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOpenAi = () => setIsOpen(true);
    window.addEventListener('sombill-ai-open', handleOpenAi);
    return () => window.removeEventListener('sombill-ai-open', handleOpenAi);
  }, [setIsOpen]);

  // Auto-scroll to bottom when messages or thinking state change
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking, isOpen]);

  // Stop speech synthesis if muted
  useEffect(() => {
    if (voiceMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [voiceMuted]);

  // Handle interactive markdown links ([Pricing](/pricing), [Contact](/contact), [Book Free Demo](/demo))
  const handleLinkNavigate = useCallback(
    (href) => {
      if (href === '/demo' && typeof onOpenDemoModal === 'function') {
        onOpenDemoModal();
        return;
      }
      if (typeof onNavigatePath === 'function') {
        onNavigatePath(href);
        return;
      }
      // Dispatch custom event so SomBillWebsite can smoothly navigate even when mounted globally in App.tsx
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sombill-ai-navigate', { detail: { path: href } }));
      }
    },
    [onNavigatePath, onOpenDemoModal],
  );

  // Web Speech API (SpeechRecognition) handler
  const handleToggleVoiceInput = () => {
    if (typeof window === 'undefined') return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) {
      setInputValue('How do I get a free SomBill POS demo?');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setLiveTranscript('Listening...');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          transcript += event.results[i][0].transcript;
        }
        setLiveTranscript(transcript);
        setInputValue(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setLiveTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setLiveTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    sendMessage(inputValue);
  };

  return (
    <div className="lcb-root">
      {/* Glassmorphic Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="sombill-ai-window"
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.94 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="lcb-window"
            role="dialog"
            aria-label="SomBill AI v2.0 POS and Hospitality Assistant"
          >
            {/* Flowing 2px Top Laser Border */}
            <div className="lcb-window-border-anim" />

            {/* Decorative Neural Network SVG & 18 Twinkling Stars */}
            <div className="lcb-neural-bg" aria-hidden="true">
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 370 560"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="opacity-20"
              >
                <g stroke="url(#sombillNeuralGrad)" strokeWidth="0.8">
                  <line x1="35" y1="70" x2="140" y2="130" />
                  <line x1="140" y1="130" x2="290" y2="95" />
                  <line x1="290" y1="95" x2="330" y2="220" />
                  <line x1="140" y1="130" x2="90" y2="260" />
                  <line x1="90" y1="260" x2="230" y2="310" />
                  <line x1="230" y1="310" x2="330" y2="220" />
                  <line x1="90" y1="260" x2="55" y2="420" />
                  <line x1="230" y1="310" x2="285" y2="450" />
                  <line x1="55" y1="420" x2="285" y2="450" />
                </g>
                <g fill="#f97316" fillOpacity="0.45">
                  <circle cx="35" cy="70" r="3" />
                  <circle cx="140" cy="130" r="3.5" />
                  <circle cx="290" cy="95" r="3" />
                  <circle cx="330" cy="220" r="3" />
                  <circle cx="90" cy="260" r="3.5" />
                  <circle cx="230" cy="310" r="3.5" />
                  <circle cx="55" cy="420" r="3" />
                  <circle cx="285" cy="450" r="3" />
                </g>
                <defs>
                  <linearGradient id="sombillNeuralGrad" x1="0" y1="0" x2="370" y2="560" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#dc2626" />
                    <stop offset="50%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>
              </svg>

              {CONSTELLATION_STARS.map((star, idx) => (
                <span
                  key={idx}
                  className="lcb-star"
                  style={{
                    top: star.top,
                    left: star.left,
                    animationDelay: star.delay,
                  }}
                />
              ))}
            </div>

            {/* Header */}
            <div className="lcb-header">
              <div className="flex items-center gap-3 min-w-0">
                <div className="lcb-avatar-wrap">
                  <div className="lcb-avatar-ring-1" />
                  <div className="lcb-avatar-ring-2" />
                  <div className="lcb-avatar-core">
                    <Brain size={19} />
                  </div>
                  <span className="lcb-avatar-status" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={11} color="#fbbf24" className="shrink-0" />
                    <span className="font-extrabold text-sm text-white truncate">SomBill AI</span>
                    <span className="lcb-version-pill">v2.0</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-400 font-medium truncate">
                    <span>POS & Hospitality Engine Active</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setVoiceMuted((m) => !m)}
                  className="lcb-header-btn"
                  title={voiceMuted ? 'Unmute Voice Readback' : 'Mute Voice Readback'}
                  aria-label={voiceMuted ? 'Unmute Voice Readback' : 'Mute Voice Readback'}
                >
                  {voiceMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button
                  type="button"
                  onClick={clearChat}
                  className="lcb-header-btn"
                  title="Clear Conversation"
                  aria-label="Clear Conversation"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  type="button"
                  onClick={toggleOpen}
                  className="lcb-header-btn"
                  title="Close Assistant"
                  aria-label="Close Assistant"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Capability Pills Bar */}
            <div className="lcb-cap-bar">
              <span className="lcb-cap-pill">⚡ Instant POS Help</span>
              <span className="lcb-cap-pill">🌍 EN & Somali</span>
              <span className="lcb-cap-pill">🎙️ Voice AI</span>
              <span className="lcb-cap-pill">🧠 Smart Billing</span>
            </div>

            {/* Conversation Messages */}
            <div className="lcb-messages">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={msg.sender === 'bot' ? 'lcb-bubble-bot' : 'lcb-bubble-user'}
                >
                  <div className="space-y-1">{renderMessageBody(msg.text, handleLinkNavigate)}</div>
                  <div
                    className={`mt-1.5 text-[9.5px] font-mono ${
                      msg.sender === 'bot' ? 'text-slate-400' : 'text-white/80 text-right'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </motion.div>
              ))}

              {/* 3 Bouncing Neural Dots Typing Indicator */}
              {isThinking && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="lcb-typing-wrap">
                  <div className="lcb-typing-dots">
                    <span className="lcb-typing-dot" />
                    <span className="lcb-typing-dot" />
                    <span className="lcb-typing-dot" />
                  </div>
                  <span className="text-[11px] font-mono text-[#fdba74]">SomBill AI is thinking...</span>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Live Voice Recognition Transcript Bar */}
            {isListening && (
              <div className="lcb-voice-preview">
                <div className="flex items-center gap-2 min-w-0">
                  <VoiceWave />
                  <span className="truncate font-mono">{liveTranscript || 'Listening (EN / SO)...'}</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleVoiceInput}
                  className="text-[10px] font-bold text-white underline shrink-0 cursor-pointer"
                >
                  Stop
                </button>
              </div>
            )}

            {/* Page-Aware Quick Suggestion Chips */}
            <div className="lcb-chips-row">
              {activeChips.map((chip, idx) => (
                <button key={idx} type="button" onClick={() => sendMessage(chip.query)} className="lcb-chip">
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleFormSubmit} className="lcb-input-area">
              <div className="lcb-input-row">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask in English or Somali (e.g. Zaad, POS, Pricing)..."
                  className="lcb-input"
                  aria-label="Ask SomBill AI a question"
                />

                <button
                  type="button"
                  onClick={handleToggleVoiceInput}
                  className={`lcb-mic-btn ${isListening ? 'is-listening' : ''}`}
                  title={isListening ? 'Stop Voice Input' : 'Speak Your Question'}
                  aria-label={isListening ? 'Stop Voice Input' : 'Speak Your Question'}
                >
                  {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>

                <button
                  type="submit"
                  disabled={!inputValue.trim() || isThinking}
                  className="lcb-send-btn"
                  title="Send Message"
                  aria-label="Send Message"
                >
                  <Send size={15} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom-Right Floating Trigger Button (60px x 60px) with 3 Counter-Rotating Orbital Rings */}
      <div className="lcb-trigger-wrap">
        <div className="lcb-ring lcb-ring-1" />
        <div className="lcb-ring lcb-ring-2" />
        <div className="lcb-ring lcb-ring-3" />
        {!isOpen && unreadCount > 0 && <div className="lcb-welcome-pulse" />}

        <button
          type="button"
          onClick={toggleOpen}
          className="lcb-trigger-btn"
          aria-label={isOpen ? 'Close SomBill AI Assistant' : 'Open SomBill AI Assistant'}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isOpen ? (
              <motion.span
                key="icon-close"
                initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center"
              >
                <X size={22} />
              </motion.span>
            ) : (
              <motion.span
                key="icon-brain"
                initial={{ rotate: 90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center"
              >
                <Brain size={24} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <span className="lcb-online-dot" aria-hidden="true" />
        {!isOpen && unreadCount > 0 && <span className="lcb-badge-count">{unreadCount}</span>}
      </div>
    </div>
  );
};

export default ChatBotWidget;
