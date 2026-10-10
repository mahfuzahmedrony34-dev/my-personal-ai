import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDown, ArrowUpRight, Bot, Check, CheckCheck, CircleHelp, Command, Download, FileText, Globe, Laptop, Menu, MessageCircle, Moon, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, Sun, Trash2, Wifi, WifiOff, X, Zap } from 'lucide-react'

type Note = { id: string; title: string; body: string; updated: number }
type Task = { id: string; title: string; done: boolean; due?: string; notified?: boolean }
type Message = { id: string; role: 'user' | 'assistant'; text: string; time: number }
type Saved = { notes: Note[]; tasks: Task[]; messages: Message[] }

const initialMessages: Message[] = [
  { id: 'welcome', role: 'assistant', text: "Hey! I'm Orbit, your personal workspace. I can help you think, plan, write, and stay organised. Ask me anything—or save something for later.", time: Date.now() },
]
const readSaved = (): Saved => {
  try {
    const raw = localStorage.getItem('orbit-workspace-v1')
    if (raw) return JSON.parse(raw) as Saved
  } catch { /* use fresh workspace */ }
  return { notes: [], tasks: [], messages: initialMessages }
}
const uid = () => crypto.randomUUID?.() ?? String(Date.now() + Math.random())
const fmt = (timestamp: number) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(timestamp)

export default function App() {
  const [saved, setSaved] = useState<Saved>(readSaved)
  const [tab, setTab] = useState<'chat' | 'notes' | 'tasks'>('chat')
  const [draft, setDraft] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [taskDraft, setTaskDraft] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [webSearch, setWebSearch] = useState(false)
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [search, setSearch] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(true)
  const [installPrompt, setInstallPrompt] = useState<any>(null)

  useEffect(() => {
    localStorage.setItem('orbit-workspace-v1', JSON.stringify(saved))
  }, [saved])
  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event) }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('beforeinstallprompt', onInstall)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('beforeinstallprompt', onInstall)
    }
  }, [])

  const filteredNotes = useMemo(() => saved.notes.filter(note => (note.title + ' ' + note.body).toLowerCase().includes(search.toLowerCase())), [saved.notes, search])
  const completed = saved.tasks.filter(task => task.done).length

  useEffect(() => {
    const checkReminders = () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      const now = Date.now()
      setSaved(current => {
        let changed = false
        const tasks = current.tasks.map(task => {
          if (!task.done && task.due && !task.notified && new Date(task.due).getTime() <= now) {
            new Notification('Orbit reminder', { body: task.title })
            changed = true
            return { ...task, notified: true }
          }
          return task
        })
        return changed ? { ...current, tasks } : current
      })
    }
    checkReminders()
    const timer = window.setInterval(checkReminders, 30000)
    return () => window.clearInterval(timer)
  }, [])

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    const userMessage: Message = { id: uid(), role: 'user', text, time: Date.now() }
    setSaved(current => ({ ...current, messages: [...current.messages, userMessage] }))
    setDraft('')
    setBusy(true)
    if (!navigator.onLine) {
      setSaved(current => ({ ...current, messages: [...current.messages, { id: uid(), role: 'assistant', text: "You're offline right now, so I can't reach the online AI. Your message is saved here. You can still use Notes and Tasks, or reconnect and try again.", time: Date.now() }] }))
      setBusy(false)
      return
    }
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...saved.messages.filter(m => m.id !== 'welcome').slice(-12), userMessage].map(m => ({ role: m.role, content: m.text })), webSearch }),
      })
      if (!response.ok) throw new Error('AI endpoint is not configured yet')
      const data = await response.json() as { reply?: string; message?: string }
      if (!data.reply) throw new Error(data.message || 'The AI did not return a reply')
      setSaved(current => ({ ...current, messages: [...current.messages, { id: uid(), role: 'assistant', text: data.reply!, time: Date.now() }] }))
    } catch {
      setSaved(current => ({ ...current, messages: [...current.messages, { id: uid(), role: 'assistant', text: "I couldn't reach Gemini just now. Check your connection and the server-side Gemini configuration, then try again. Your chats and notes stay saved on this device.", time: Date.now() }] }))
    } finally { setBusy(false) }
  }

  const addNote = (event: FormEvent) => {
    event.preventDefault()
    if (!noteTitle.trim() && !noteBody.trim()) return
    const note: Note = { id: uid(), title: noteTitle.trim() || 'Untitled note', body: noteBody.trim(), updated: Date.now() }
    setSaved(current => ({ ...current, notes: [note, ...current.notes] }))
    setNoteTitle(''); setNoteBody('')
  }
  const addTask = (event: FormEvent) => {
    event.preventDefault()
    if (!taskDraft.trim()) return
    if (taskDue && typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission()
    setSaved(current => ({ ...current, tasks: [{ id: uid(), title: taskDraft.trim(), done: false, due: taskDue || undefined }, ...current.tasks] }))
    setTaskDraft(''); setTaskDue('')
  }
  const suggestions = ['Make a daily study planner for me', 'Explain a difficult topic', 'Summarize my study notes']

  return (
    <div className={dark ? 'app' : 'app light'}>
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand"><div className="brand-mark"><Sparkles size={20}/></div><div><strong>orbit</strong><span>YOUR PERSONAL SPACE</span></div><button className="icon-btn mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18}/></button></div>
        <button className={tab === 'chat' ? 'nav-item active' : 'nav-item'} onClick={() => { setTab('chat'); setMenuOpen(false) }}><MessageCircle size={18}/> AI Chat <span className="nav-badge">01</span></button>
        <button className={tab === 'notes' ? 'nav-item active' : 'nav-item'} onClick={() => { setTab('notes'); setMenuOpen(false) }}><FileText size={18}/> My Notes <span className="nav-count">{saved.notes.length || ''}</span></button>
        <button className={tab === 'tasks' ? 'nav-item active' : 'nav-item'} onClick={() => { setTab('tasks'); setMenuOpen(false) }}><CheckCheck size={18}/> Tasks <span className="nav-count">{saved.tasks.filter(t => !t.done).length || ''}</span></button>
        <div className="sidebar-bottom">
          <div className="privacy-card"><ShieldCheck size={17}/><div><b>Your space, your data</b><p>Notes and tasks are saved on this device.</p></div></div>
          <button className="nav-item" onClick={() => setShowSettings(true)}><Settings2 size={18}/> Settings</button>
          <div className="profile"><div className="avatar">R</div><div className="profile-copy"><b>My Workspace</b><span>Personal assistant</span></div><button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Open settings"><Settings2 size={17}/></button></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20}/></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="slash">/</span><b>{tab === 'chat' ? 'AI Chat' : tab === 'notes' ? 'My Notes' : 'Tasks'}</b></div>
          <div className="top-actions"><span className={online ? 'connection online' : 'connection offline'}>{online ? <Wifi size={14}/> : <WifiOff size={14}/>}<span>{online ? 'Online' : 'Offline'}</span></span><button className="icon-btn" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="settings-top" onClick={() => setShowSettings(true)}><Settings2 size={16}/><span>Settings</span></button></div>
        </header>

        <div className="content">
          {tab === 'chat' && <section className="chat-page">
            <div className="eyebrow"><span className="status-dot"/> PERSONAL AI WORKSPACE</div>
            <h1>Your thoughts,<br/><span>with a little more</span> clarity.</h1>
            <p className="intro">A space to ask, explore, and get things done. What's on your mind?</p>
            <div className="chat-panel">
              <div className="panel-head"><div className="assistant-avatar"><Bot size={20}/></div><div><b>Orbit Assistant</b><span>{online ? 'Ready when you are' : 'Offline · saved workspace available'}</span></div><div className="model-pill"><span className="status-dot"/> {online ? 'ONLINE MODE' : 'OFFLINE MODE'}</div></div>
              <div className="messages">
                {saved.messages.map(message => <div key={message.id} className={'message-row ' + message.role}><div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={15}/> : 'R'}</div><div className="message-body"><div className="message-meta"><b>{message.role === 'assistant' ? 'Orbit' : 'You'}</b><span>{fmt(message.time)}</span></div><p>{message.text}</p></div></div>)}
                {busy && <div className="typing"><span/><span/><span/> Orbit is thinking…</div>}
              </div>
              <div className="suggestions">{suggestions.map(item => <button key={item} onClick={() => setDraft(item)}>{item}<ArrowUpRight size={14}/></button>)}</div>
              <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',padding:'0 16px 12px',fontSize:12,color:'var(--muted)'}}>
                <label style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer'}}><input type="checkbox" checked={webSearch} onChange={e => setWebSearch(e.target.checked)}/> Search the web (Gemini)</label>
                <label style={{display:'inline-flex',alignItems:'center',gap:7,cursor:'pointer'}}><FileText size={14}/> Read text file<input type="file" accept=".txt,.md,.csv,.json,.log,text/plain,text/markdown,text/csv,application/json" style={{maxWidth:170,fontSize:11}} onChange={async e => { const file=e.target.files?.[0]; if(!file)return; if(file.size>1500000){setDraft('File is too large. Please choose a text file under 1.5 MB.');return;} try { const contents=await file.text(); setDraft('Please read and summarize this file named "'+file.name+'". Explain key ideas, important facts, and action items in simple language.\\n\\n'+contents.slice(0,45000)); } catch { setDraft('I could not read that file. Please try a .txt, .md, .csv, or .json file.'); } e.currentTarget.value=''; }}/></label>
              </div>
              <form className="composer" onSubmit={sendMessage}><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message your assistant…" rows={2} aria-label="Message your assistant" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }}/><div className="composer-foot"><span><ShieldCheck size={13}/> Your workspace is saved on this device</span><button className="send-btn" type="submit" disabled={!draft.trim() || busy} aria-label="Send message"><Send size={17}/></button></div></form>
            </div>
            <div className="feature-row"><div><Zap size={17}/><span><b>Quick & focused</b><small>Less noise, more clarity</small></span></div><div><ShieldCheck size={17}/><span><b>Private by design</b><small>Local notes & tasks</small></span></div><div><Activity size={17}/><span><b>Online + offline</b><small>Built for real life</small></span></div></div>
          </section>}

          {tab === 'notes' && <section className="subpage"><div className="eyebrow"><span className="status-dot"/> YOUR PERSONAL LIBRARY</div><h1>Keep the good <span>thoughts.</span></h1><p className="intro">Little reminders, big ideas, and everything in between.</p><form className="note-form" onSubmit={addNote}><input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Note title"/><textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="Write something worth keeping…" rows={3}/><button className="primary-btn" type="submit"><Plus size={16}/> Save note</button></form><div className="section-toolbar"><b>Your notes <span className="muted-count">{saved.notes.length}</span></b><label className="search-box"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes"/></label></div>{filteredNotes.length ? <div className="notes-grid">{filteredNotes.map(note => <article className="note-card" key={note.id}><div className="note-card-top"><FileText size={17}/><button className="icon-btn" onClick={() => setSaved(s => ({...s, notes:s.notes.filter(n => n.id !== note.id)}))} aria-label="Delete note"><Trash2 size={15}/></button></div><h3>{note.title}</h3><p>{note.body || 'No extra details.'}</p><small>Saved {new Date(note.updated).toLocaleDateString()}</small></article>)}</div> : <div className="empty-state"><div><FileText size={24}/></div><b>No notes yet</b><p>Save your first idea above. It'll be here even when you're offline.</p></div>}</section>}

          {tab === 'tasks' && <section className="subpage"><div className="eyebrow"><span className="status-dot"/> YOUR DAY, YOUR PACE</div><h1>Small steps. <span>Real progress.</span></h1><p className="intro">A little list to help your day feel lighter.</p><div className="task-summary"><div><span>COMPLETED</span><b>{completed} <small>/ {saved.tasks.length}</small></b></div><div className="progress-track"><span style={{width: saved.tasks.length ? (completed / saved.tasks.length * 100) + '%' : '0%'}}/></div></div><form className="task-form" onSubmit={addTask}><input value={taskDraft} onChange={e => setTaskDraft(e.target.value)} placeholder="What would you like to get done?"/><input type="datetime-local" aria-label="Optional reminder time" value={taskDue} onChange={e => setTaskDue(e.target.value)} title="Optional reminder time"/><button className="primary-btn" type="submit"><Plus size={16}/> Add task</button></form><div className="task-list">{saved.tasks.map(task => <div key={task.id} className={'task-item ' + (task.done ? 'done' : '')}><button className="task-check" onClick={() => setSaved(s => ({...s,tasks:s.tasks.map(t => t.id === task.id ? {...t,done:!t.done} : t)}))} aria-label={task.done ? 'Mark incomplete' : 'Complete task'}>{task.done && <Check size={15}/>}</button><span>{task.title}{task.due && <small style={{display:'block',fontSize:11,opacity:.7,marginTop:4}}>Reminder: {new Date(task.due).toLocaleString()}</small>}</span><button className="icon-btn" onClick={() => setSaved(s => ({...s,tasks:s.tasks.filter(t => t.id !== task.id)}))} aria-label="Delete task"><Trash2 size={15}/></button></div>)}</div>{!saved.tasks.length && <div className="empty-state"><div><CheckCheck size={24}/></div><b>Nothing on the list yet</b><p>Add one small thing you want to finish today.</p></div>}</section>}
        </div>
        <footer className="footer"><span>ORBIT <span className="footer-dot">✳</span> MADE FOR YOUR EVERYDAY</span><span>Saved locally on this device</span></footer>
      </main>

      {showSettings && <div className="modal-backdrop" onClick={() => setShowSettings(false)}><section className="settings-modal" onClick={e => e.stopPropagation()}><div className="modal-title"><div><div className="eyebrow">YOUR WORKSPACE</div><h2>Settings</h2></div><button className="icon-btn" onClick={() => setShowSettings(false)} aria-label="Close settings"><X size={19}/></button></div><div className="setting-line"><div className="setting-icon"><ShieldCheck size={18}/></div><div><b>Device storage</b><p>Notes, tasks and chat history are stored in this browser on this device.</p></div></div><div className="setting-line"><div className="setting-icon">{online ? <Globe size={18}/> : <WifiOff size={18}/>}</div><div><b>Connection</b><p>{online ? 'Online. Gemini AI works when the server-side API key is configured.' : 'Offline. Your saved workspace is still available.'}</p></div></div><div className="setting-line"><div className="setting-icon"><Download size={18}/></div><div><b>Install app</b><p>Add Orbit to your home screen for an app-like experience.</p>{installPrompt && <button className="primary-btn small" onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null) }}>Install Orbit</button>}</div></div><div className="setting-line"><div className="setting-icon"><Trash2 size={18}/></div><div><b>Clear local workspace</b><p>This permanently removes the notes, tasks and chat history saved in this browser.</p><button className="danger-btn" onClick={() => { if (confirm('Delete all local notes, tasks and chat history?')) { const fresh = {notes:[],tasks:[],messages:initialMessages}; setSaved(fresh); localStorage.removeItem('orbit-workspace-v1') } }}>Clear my data</button></div></div><div className="modal-note"><CircleHelp size={16}/><span>Gemini API key is read only by the server. Add GEMINI_API_KEY in Vercel Environment Variables; never put it in this browser app.</span></div></section></div>}
    </div>
  )
}
