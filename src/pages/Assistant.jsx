import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  Trash2,
  Zap,
  BookOpen,
  MessageSquare,
  ChevronRight,
  Loader2,
} from 'lucide-react'

import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { toast } from '../components/ui/Toast'

import { askRulesAssistant } from '../lib/anthropic'
import { cn } from '../lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_QUESTIONS = [
  { label: 'What is the 3-step protocol?',    icon: '📋' },
  { label: '12-second rule explanation',       icon: '⏱️' },
  { label: 'Player sanction procedure',        icon: '🟡' },
  { label: 'LJ positioning rules',            icon: '📍' },
  { label: 'Captain communication rules',     icon: '🗣️' },
  { label: 'Substitution procedure',          icon: '🔄' },
]

// ─── Markdown renderer (basic) ────────────────────────────────────────────────

function renderMarkdown(text) {
  // Split into lines, handle bold and rule references
  const lines = text.split('\n')
  return lines.map((line, lineIdx) => {
    // Replace **bold**
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    const rendered = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
      }
      // Highlight rule references like "Rule 13.1.2"
      const rulePattern = /(Rule\s[\d.]+(?:\.\d+)*)/g
      const subParts = part.split(rulePattern)
      return subParts.map((sp, j) =>
        rulePattern.test(sp) ? (
          <span key={j} className="text-[#E85D26] font-medium">{sp}</span>
        ) : sp
      )
    })

    // Handle list items
    const trimmed = line.trim()
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      return (
        <li key={lineIdx} className="flex gap-2 leading-relaxed">
          <span className="text-[#E85D26] mt-1 shrink-0">•</span>
          <span>{rendered}</span>
        </li>
      )
    }
    // Headings (## or ###)
    if (trimmed.startsWith('### ')) {
      return <p key={lineIdx} className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-3 mb-1">{trimmed.slice(4)}</p>
    }
    if (trimmed.startsWith('## ')) {
      return <p key={lineIdx} className="text-sm font-bold text-white mt-3 mb-1">{trimmed.slice(3)}</p>
    }

    return trimmed === '' ? (
      <div key={lineIdx} className="h-2" />
    ) : (
      <p key={lineIdx} className="leading-relaxed">{rendered}</p>
    )
  })
}

// ─── Loading dots ─────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: '900ms' }}
        />
      ))}
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-2.5 max-w-full', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#2D3270] flex items-center justify-center shrink-0 mt-0.5 border border-[#2D3270]/50">
          <BookOpen size={13} className="text-[#7B85C9]" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm',
          isUser
            ? 'bg-[#2D3270]/60 text-gray-100 rounded-tr-sm ml-auto'
            : 'bg-gray-900 border border-white/10 text-gray-200 rounded-tl-sm'
        )}
      >
        {message.loading ? (
          <LoadingDots />
        ) : (
          <div className="space-y-0.5">
            {renderMarkdown(message.content)}
          </div>
        )}
        {!message.loading && (
          <p className={cn(
            'text-[10px] mt-2 select-none',
            isUser ? 'text-gray-400 text-right' : 'text-gray-600'
          )}>
            {isUser ? 'You' : 'BVB RC Assistant'}
            {message.timestamp && (
              <> · {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Quick Question Chip ──────────────────────────────────────────────────────

function QuickChip({ question, onClick }) {
  return (
    <button
      onClick={() => onClick(question.label)}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left',
        'bg-gray-900 border border-white/10 hover:border-[#E85D26]/40 hover:bg-[#2D3270]/15',
        'transition-all duration-150 group'
      )}
    >
      <span className="text-base leading-none shrink-0">{question.icon}</span>
      <span className="text-gray-300 group-hover:text-white transition-colors text-xs font-medium flex-1">
        {question.label}
      </span>
      <ChevronRight size={12} className="text-gray-600 group-hover:text-[#E85D26] transition-colors shrink-0" />
    </button>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAsk }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4">
      {/* Icon area */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-3xl bg-[#2D3270]/30 border border-[#2D3270]/40 flex items-center justify-center">
          <MessageSquare size={36} className="text-[#7B85C9]" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-white">Rules Assistant</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xs">
            Ask anything about FIVB Beach Volleyball rules and officiating procedures
          </p>
          <div className="flex items-center gap-2 justify-center mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Powered by Claude AI · FIVB 2025 Rules</span>
          </div>
        </div>
      </div>

      {/* Quick questions */}
      <div className="w-full max-w-lg">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 text-center">
          Quick questions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QUICK_QUESTIONS.map((q) => (
            <QuickChip key={q.label} question={q} onClick={onAsk} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Assistant Page ───────────────────────────────────────────────────────────

export default function Assistant() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const threadRef = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const sendMessage = useCallback(async (text) => {
    const question = (text || input).trim()
    if (!question || isLoading) return

    setInput('')
    setIsLoading(true)

    // Add user message
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    }

    // Add loading placeholder
    const loadingId = Date.now() + 1
    const loadingMsg = {
      id: loadingId,
      role: 'assistant',
      content: '',
      loading: true,
    }

    setMessages((prev) => [...prev, userMsg, loadingMsg])

    // Build conversation history (exclude loading msg)
    const history = messages
      .filter((m) => !m.loading)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const answer = await askRulesAssistant(question, history)

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, content: answer, loading: false, timestamp: new Date().toISOString() }
            : m
        )
      )
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== loadingId))
      toast.error(`Failed to get response: ${err.message}`)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [input, isLoading, messages])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function clearConversation() {
    setMessages([])
    setInput('')
    inputRef.current?.focus()
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Rules Assistant"
        subtitle="FIVB Beach Volleyball · Official Terminology"
        actions={
          hasMessages && (
            <button
              onClick={clearConversation}
              className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Clear conversation"
            >
              <Trash2 size={15} />
            </button>
          )
        }
      />

      {/* Message thread */}
      <div
        ref={threadRef}
        className="flex-1 overflow-y-auto"
      >
        {!hasMessages ? (
          <EmptyState onAsk={sendMessage} />
        ) : (
          <div className="p-4 space-y-4 max-w-3xl mx-auto w-full">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Quick chips above input — shown when conversation has messages */}
      {hasMessages && (
        <div className="px-4 py-2 border-t border-white/5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide max-w-3xl mx-auto">
            <Zap size={11} className="text-gray-600 shrink-0" />
            {QUICK_QUESTIONS.slice(0, 4).map((q) => (
              <button
                key={q.label}
                onClick={() => sendMessage(q.label)}
                disabled={isLoading}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs whitespace-nowrap shrink-0',
                  'bg-gray-900 border border-white/10 text-gray-400',
                  'hover:border-[#2D3270]/60 hover:text-white hover:bg-[#2D3270]/20',
                  'transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                {q.icon} {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-white/10 bg-gray-950/50 backdrop-blur-sm px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about FIVB rules, signals, sanctions…"
                rows={1}
                disabled={isLoading}
                className={cn(
                  'w-full bg-gray-900 border border-white/15 rounded-xl px-4 py-2.5',
                  'text-white placeholder-gray-600 text-sm resize-none',
                  'focus:outline-none focus:border-[#E85D26]/50 focus:ring-1 focus:ring-[#E85D26]/20',
                  'transition-colors duration-150 disabled:opacity-60',
                  'max-h-32 min-h-[42px]',
                  'scrollbar-hide'
                )}
                style={{ lineHeight: '1.5' }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                }}
              />
            </div>

            <Button
              variant="primary"
              size="icon"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="shrink-0 w-10 h-10 rounded-xl"
            >
              {isLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-700">
              Press <kbd className="text-gray-600 bg-gray-800 px-1 py-0.5 rounded text-[10px] font-mono">Enter</kbd> to send
              · <kbd className="text-gray-600 bg-gray-800 px-1 py-0.5 rounded text-[10px] font-mono">Shift+Enter</kbd> for new line
            </p>
            {hasMessages && (
              <button
                onClick={clearConversation}
                className="text-xs text-gray-700 hover:text-gray-400 transition-colors flex items-center gap-1"
              >
                <Trash2 size={11} />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
