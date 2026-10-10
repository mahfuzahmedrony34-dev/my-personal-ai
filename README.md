# My Personal AI (Orbit)

A mobile-friendly personal AI workspace with a Gemini-powered chat endpoint, local notes and tasks, text-file summarization, optional Google Search grounding, and browser notifications for task reminders.

## Secure Gemini setup

1. Open the Vercel project linked to this repository.
2. Go to **Settings → Environment Variables**.
3. Add `GEMINI_API_KEY` with your Google AI Studio key as its value. Enable it for **Production** and **Preview** as needed.
4. Save the variable and redeploy the project.
5. Optional: set `GEMINI_MODEL` to a model available to your key. The default is `gemini-2.5-flash`.

**Never put the API key in frontend code, a `VITE_*` variable, or a committed file.** The key is read only by `api/chat.ts` on the Vercel server. If a key was ever pasted into a chat, issue a replacement and disable the exposed one.

## Features

- Gemini chat through the server-side `/api/chat` function.
- Optional Google Search grounding toggle in the chat composer.
- Read and summarize text-based `.txt`, `.md`, `.csv`, `.json`, and `.log` files in the browser. The current upload limit is 1.5 MB.
- Tasks with optional date/time reminders using browser notifications.
- Daily study planning via the assistant prompt suggestions.
- Notes, tasks, and chat history saved in the current browser's local storage.
- Installable PWA shell and offline access to the saved workspace.

## Reminder and offline notes

Browser notifications must be permitted. Reminders are checked while the app is open in the browser; reliable background notifications when the app is fully closed need a push-notification service worker and a server-side scheduler, which are not configured here. The current file reader is for text formats; scanned PDFs and Word documents are not parsed yet.

## Local development

```bash
npm install
npm run dev
``

Production build:

```bash
npm run build
``
