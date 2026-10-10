import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Menu, Plus, Search, Send, Sparkles, X, MessageSquare, Trash2, Paperclip, Globe, ChevronDown, PanelLeftClose, PanelLeft, MoreHorizontal } from 'lucide-react'

type Message = { id: string; role: 'user' | 'assistant'; text: string; time: number }
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number }
const STORE_KEY = 'orbit-chat-history-v2'
const OLD_KEY = 'orbit-workspace-v1'
const uid = () => crypto.randomUUID?.() ?? String(Date.now() + Math.random())
const welcome = (): Message => ({ id: 'welcome-' + uid(), role: 'assistant', text: "Hi! I'm Orbit. What can I help you with today?", time: Date.now() })
const newChat = (): Chat => ({ id: uid(), title: 'New chat', messages: [welcome()], updatedAt: Date.now() })
const titleFrom = (text: string) => text.trim().replace(/\s+/g, ' ').slice(0, 42) || 'New chat'
function loadChats(): Chat[] {
  try {
    const current = localStorage.getItem(STORE_KEY)
    if (current) {
      const parsed = JSON.parse(current) as Chat[]
      if (Array.isArray(parsed) && parsed.length) return parsed
    }
    const old = localStorage.getItem(OLD_KEY)
    if (old) {
      const data = JSON.parse(old) as { messages?: Message[] }
      if (data.messages?.length) return [{ id: uid(), title: titleFrom(data.messages.find(m => m.role === 'user')?.text || 'Previous chat'), messages: data.messages, updatedAt: Date.now() }]
    }
  } catch { /* start with a clean chat if local data is unreadable */ }
  return [newChat()]
}
function inlineParts(text: string) {
  const pieces = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g)
  return pieces.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>
    return part
  })
}
function MessageContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let list: string[] = []
  const flush = () => { if (list.length) { nodes.push(<ul key={'list-' + nodes.length}>{list.map((item, i) => <li key={i}>{inlineParts(item)}</li>)}</ul>); list = [] } }
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (/^[-*•]\s+/.test(trimmed)) { list.push(trimmed.replace(/^[-*•]\s+/, '')); return }
    flush()
    if (!trimmed) { nodes.push(<div className="md-gap" key={'gap-' + i}/>); return }
    if (/^###\s+/.test(trimmed)) nodes.push(<h3 key={i}>{inlineParts(trimmed.replace(/^###\s+/, ''))}</h3>)
    else if (/^##\s+/.test(trimmed)) nodes.push(<h2 key={i}>{inlineParts(trimmed.replace(/^##\s+/, ''))}</h2>)
    else if (/^#\s+/.test(trimmed)) nodes.push(<h2 key={i}>{inlineParts(trimmed.replace(/^#\s+/, ''))}</h2>)
    else nodes.push(<p key={i}>{inlineParts(line)}</p>)
  })
  flush()
  return <div className="message-content">{nodes}</div>
}

export default function App() {
  const [chats, setChats] = useState<Chat[]>(loadChats)
  const [activeId, setActiveId] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [webSearch, setWebSearch] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [chatSearch, setChatSearch] = useState('')
  const [attachOpen, setAttachOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const activeChat = chats.find(chat => chat.id === activeId) ?? chats[0]
  const filteredChats = useMemo(() => [...chats].sort((a,b) => b.updatedAt-a.updatedAt).filter(chat => chat.title.toLowerCase().includes(chatSearch.toLowerCase())), [chats, chatSearch])

  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify(chats)) }, [chats])
  useEffect(() => {
    const onOnline = () => setOnline(true), onOffline = () => setOnline(false)
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event) }
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); window.addEventListener('beforeinstallprompt', onInstall)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('beforeinstallprompt', onInstall) }
  }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [activeChat?.messages, busy])
  useEffect(() => { if (activeId) localStorage.setItem('orbit-active-chat-v1', activeId) }, [activeId])
  useEffect(() => {
    const savedId = localStorage.getItem('orbit-active-chat-v1')
    if (savedId && chats.some(chat => chat.id === savedId)) setActiveId(savedId)
    else if (chats[0]) setActiveId(chats[0].id)
  // Restore the last-opened conversation once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateActive = (updater: (chat: Chat) => Chat) => {
    setChats(current => current.map(chat => chat.id === activeId ? updater(chat) : chat))
  }
  const startNewChat = () => {
    const chat = newChat()
    setChats(current => [chat, ...current])
    setActiveId(chat.id); setDraft(''); setSidebarOpen(false); setWebSearch(false)
    window.setTimeout(() => inputRef.current?.focus(), 60)
  }
  const selectChat = (id: string) => { setActiveId(id); setSidebarOpen(false); setDraft('') }
  const deleteChat = (id: string) => {
    const remaining = chats.filter(chat => chat.id !== id)
    if (!remaining.length) { const fresh = newChat(); setChats([fresh]); setActiveId(fresh.id) }
    else { setChats(remaining); if (activeId === id) setActiveId(remaining[0].id) }
  }
  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || busy || !activeChat) return
    const userMessage: Message = { id: uid(), role: 'user', text, time: Date.now() }
    const history = activeChat.messages.filter(m => !m.id.startsWith('welcome-'))
    const updatedTitle = activeChat.title === 'New chat' ? titleFrom(text) : activeChat.title
    setChats(current => current.map(chat => chat.id === activeId ? { ...chat, title: updatedTitle, messages: [...chat.messages, userMessage], updatedAt: Date.now() } : chat))
    setDraft(''); setBusy(true); setAttachOpen(false)
    if (!navigator.onLine) {
      setChats(current => current.map(chat => chat.id === activeId ? { ...chat, messages: [...chat.messages, { id: uid(), role: 'assistant', text: "You're offline right now, so I can't reach the online AI. Your message is saved in this chat. Reconnect and try again.", time: Date.now() }] } : chat))
      setBusy(false); return
    }
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [...history.slice(-11), userMessage].map(m => ({ role: m.role, content: m.text })), webSearch }) })
      const data = await response.json() as { reply?: string; message?: string; sources?: { title?: string; uri: string }[] }
      if (!response.ok || !data.reply) throw new Error(data.message || 'The AI did not return a reply')
      const sourceText = data.sources?.length ? '\n\n**Sources**\n' + data.sources.map((source, i) => (i + 1) + '. [' + (source.title || source.uri) + '](' + source.uri + ')').join('\n') : ''
      const reply: Message = { id: uid(), role: 'assistant', text: data.reply + sourceText, time: Date.now() }
      setChats(current => current.map(chat => chat.id === activeId ? { ...chat, messages: [...chat.messages, reply], updatedAt: Date.now() } : chat))
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error'
      const reply: Message = { id: uid(), role: 'assistant', text: "I couldn't get a reply just now. " + detail + " Check the connection and Gemini server configuration, then try again.", time: Date.now() }
      setChats(current => current.map(chat => chat.id === activeId ? { ...chat, messages: [...chat.messages, reply], updatedAt: Date.now() } : chat))
    } finally { setBusy(false) }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() } }
  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 1500000) { setDraft('This file is too large. Please choose a text file under 1.5 MB.'); event.target.value = ''; return }
    try { const contents = await file.text(); setDraft('Please read and summarize this file named "' + file.name + '". Explain key ideas, important facts, and action items in simple language.\n\n' + contents.slice(0,45000)); inputRef.current?.focus() }
    catch { setDraft('I could not read that file. Please try a .txt, .md, .csv, or .json file.') }
    event.target.value = ''
  }
  const hasConversation = activeChat?.messages.some(message => message.role === 'user') ?? false

  return <div className="orbit-app">
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}/>}
    <aside className={'chat-sidebar ' + (sidebarOpen ? 'is-open' : '')}>
      <div className="sidebar-top">
        <button className="brand-button" onClick={startNewChat} aria-label="Orbit home"><span className="brand-icon"><Sparkles size={19}/></span><span>Orbit</span></button>
        <button className="icon-button sidebar-collapse" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><PanelLeftClose size={18}/></button>
      </div>
      <button className="new-chat-button" onClick={startNewChat}><Plus size={17}/><span>New chat</span><span className="new-chat-shortcut">＋</span></button>
      <button className="sidebar-search" onClick={() => setSearchOpen(value => !value)}><Search size={16}/><span>Search chats</span></button>
      {searchOpen && <input className="chat-search-input" value={chatSearch} onChange={e => setChatSearch(e.target.value)} placeholder="Search recent chats…" autoFocus/>}
      <div className="recent-heading">Recent</div>
      <div className="recent-list">
        {filteredChats.map(chat => <div key={chat.id} className={'recent-item ' + (chat.id === activeId ? 'selected' : '')}>
          <button className="recent-select" onClick={() => selectChat(chat.id)} title={chat.title}><MessageSquare size={15}/><span>{chat.title}</span></button>
          <button className="recent-delete" onClick={() => deleteChat(chat.id)} aria-label={'Delete ' + chat.title} title="Delete chat"><Trash2 size={14}/></button>
        </div>)}
        {!filteredChats.length && <div className="no-recent">No matching chats</div>}
      </div>
      <div className="sidebar-bottom">
        <div className="connection-note"><span className={'connection-dot ' + (online ? 'online' : 'offline')}/><span>{online ? 'Online' : 'Offline'}</span><span className="connection-separator">·</span><span>Chats saved on this device</span></div>
        {installPrompt && <button className="install-button" onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null) }}>Install Orbit on this device</button>}
      </div>
    </aside>
    <main className="chat-main">
      <header className="chat-topbar">
        <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open recent chats"><Menu size={20}/></button>
        <button className="mobile-brand" onClick={() => setSidebarOpen(true)}><Sparkles size={17}/> Orbit <ChevronDown size={14}/></button>
        <div className="topbar-title">{activeChat?.title || 'New chat'}</div>
        <button className="icon-button desktop-sidebar-toggle" onClick={() => setSidebarOpen(value => !value)} aria-label="Toggle sidebar"><PanelLeft size={18}/></button>
        <div className={'online-indicator ' + (online ? 'online' : 'offline')} title={online ? 'Online' : 'Offline'}><span/>{online ? 'Online' : 'Offline'}</div>
      </header>
      <section className={'conversation ' + (!hasConversation ? 'is-empty' : '')}>
        {!hasConversation ? <div className="welcome-screen">
          <div className="welcome-mark"><Sparkles size={25}/></div>
          <h1>What can I help with?</h1>
          <p>Ask anything. Let's work through it together.</p>
          <div className="prompt-suggestions">
            {['Explain a difficult topic simply','Help me write something','Make a study plan'].map((item, i) => <button key={item} onClick={() => { setDraft(item); inputRef.current?.focus() }}><span>{item}</span><span className="suggestion-symbol">{i === 0 ? '✳' : i === 1 ? '↗' : '▤'}</span></button>)}
          </div>
        </div> : <div className="message-list">
          {activeChat?.messages.filter(message => !message.id.startsWith('welcome-')).map(message => <article key={message.id} className={'chat-message ' + message.role}>
            {message.role === 'assistant' && <div className="response-avatar"><Sparkles size={16}/></div>}
            <div className="message-inner">
              {message.role === 'user' ? <div className="user-bubble"><MessageContent text={message.text}/></div> : <MessageContent text={message.text}/>}
            </div>
          </article>)}
          {busy && <article className="chat-message assistant"><div className="response-avatar"><Sparkles size={16}/></div><div className="message-inner"><div className="thinking"><span/><span/><span/> <em>Thinking</em></div></div></article>}
          <div ref={endRef}/>
        </div>}
      </section>
      <div className="composer-area">
        <form className="chat-composer" onSubmit={sendMessage}>
          <textarea ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={onKeyDown} placeholder="Message Orbit…" rows={1} aria-label="Message Orbit" />
          <div className="composer-tools">
            <div className="composer-left">
              <div className="attach-wrap">
                <button type="button" className={'tool-button ' + (attachOpen ? 'tool-active' : '')} aria-label="Attach text file" title="Attach a text file" onClick={() => { setAttachOpen(value => !value); if (!attachOpen) fileRef.current?.click() }}><Paperclip size={17}/></button>
                <input ref={fileRef} className="hidden-file" type="file" accept=".txt,.md,.csv,.json,.log,text/plain,text/markdown,text/csv,application/json" onChange={handleFile}/>
              </div>
              <button type="button" className={'tool-button web-tool ' + (webSearch ? 'tool-active' : '')} onClick={() => setWebSearch(value => !value)} title={webSearch ? 'Web search enabled' : 'Enable web search'}><Globe size={16}/><span>Search</span></button>
            </div>
            <button className="send-button" type="submit" disabled={!draft.trim() || busy} aria-label="Send message"><Send size={17}/></button>
          </div>
        </form>
        <p className="disclaimer">{webSearch ? 'Web search is on. ' : ''}Orbit can make mistakes. Check important information.</p>
      </div>
    </main>
  </div>
}
