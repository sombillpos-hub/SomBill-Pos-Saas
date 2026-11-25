import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_CHIPS, FALLBACK_RESPONSE, KNOWLEDGE_BASE, PAGE_CHIPS, WELCOME_MESSAGE } from '../services/chatData';

function formatNowTime() {
  try {
    return new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Now';
  }
}

/**
 * Matches user input against KNOWLEDGE_BASE (case-insensitive substring match across keywords[])
 */
export function matchKnowledgeBase(queryText) {
  const normalized = (queryText || '').toLowerCase().trim();
  if (!normalized) return FALLBACK_RESPONSE;

  let bestMatch = null;
  let bestScore = 0;

  for (const item of KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of item.keywords) {
      const lowerKw = kw.toLowerCase();
      if (normalized.includes(lowerKw)) {
        // Longer keyword matches carry slightly higher specificity weight
        score += lowerKw.length >= 5 ? 3 : 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch ? bestMatch.response : FALLBACK_RESPONSE;
}

/**
 * Custom hook managing SomBill AI v2.0 chat state, unread badge, page-aware chips, and realistic thinking delay (600–1100ms)
 */
export function useChatBot({ currentPathname = '/', onBotReply } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1);
  const timerRef = useRef(null);

  const activeChips = PAGE_CHIPS[currentPathname] || DEFAULT_CHIPS;

  // Clear unread badge when user opens the chat window
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const sendMessage = useCallback(
    (rawText) => {
      const text = (rawText ?? inputValue).trim();
      if (!text || isThinking) return;

      const userMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: formatNowTime(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setIsThinking(true);

      // Realistic thinking delay between 600ms and 1100ms
      const delay = Math.floor(600 + Math.random() * 500);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const replyText = matchKnowledgeBase(text);
        const botMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: replyText,
          timestamp: formatNowTime(),
        };

        setMessages((prev) => [...prev, botMessage]);
        setIsThinking(false);

        setIsOpen((currentlyOpen) => {
          if (!currentlyOpen) {
            setUnreadCount((c) => c + 1);
          }
          return currentlyOpen;
        });

        if (typeof onBotReply === 'function') {
          onBotReply(replyText);
        }
      }, delay);
    },
    [inputValue, isThinking, onBotReply],
  );

  const clearChat = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsThinking(false);
    setMessages([
      {
        ...WELCOME_MESSAGE,
        id: `sombill-welcome-${Date.now()}`,
        timestamp: formatNowTime(),
      },
    ]);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
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
  };
}
