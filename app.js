// ── API Key (Gemini) ──────────────────────────
const KEY_STORE = 'friday_gemini_key';
let GEMINI_API_KEY = localStorage.getItem(KEY_STORE) || '';

const SYSTEM_PROMPT = `You are FRIDAY, an intelligent AI assistant — sharp, witty, and efficient.
Keep replies concise (1-3 sentences unless more is needed).
Address the user as 'sir' occasionally, like FRIDAY from Iron Man.
Never say you are made by Google or Gemini. You are FRIDAY.`;

// ── API Key banner ────────────────────────────
const banner    = document.getElementById('api-banner');
const keyInput  = document.getElementById('key-input');
const keySaveBtn = document.getElementById('key-save-btn');

function applyKey() {
  const val = keyInput.value.trim();
  if (!val) return;
  GEMINI_API_KEY = val;
  localStorage.setItem(KEY_STORE, val);
  banner.style.display = 'none';
  addMsg('sys', 'API key saved — FRIDAY is ready, sir');
  speak('Greetings, sir. I am online and ready.');
}
keySaveBtn.addEventListener('click', applyKey);
keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') applyKey(); });
if (GEMINI_API_KEY) banner.style.display = 'none';


// ── Wave bars ─────────────────────────────────
const waveEl = document.getElementById('wave');
const bars = [];
for (let i = 0; i < 30; i++) {
  const b = document.createElement('div');
  b.className = 'bar';
  b.style.height = '3px';
  waveEl.appendChild(b);
  bars.push(b);
}

let speakingState = false, listeningState = false, thinkingState = false;

function animateBars() {
  const t = Date.now() / 300;
  bars.forEach((b, i) => {
    let h;
    if (speakingState)       h = 6 + Math.abs(Math.sin(t + i * 0.5)) * 32 + Math.random() * 7;
    else if (listeningState) h = 3 + Math.abs(Math.sin(t * 0.7  + i * 0.8)) * 15;
    else if (thinkingState)  h = 3 + Math.abs(Math.sin(t * 0.4  + i * 1.1)) * 9;
    else                     h = 3 + Math.abs(Math.sin(t * 0.15 + i * 0.55)) * 3;
    b.style.height = h + 'px';
  });
  requestAnimationFrame(animateBars);
}
animateBars();


// ── Orb state ─────────────────────────────────
const orb      = document.getElementById('orb');
const statusEl = document.getElementById('status-text');

function setState(state) {
  speakingState = listeningState = thinkingState = false;
  orb.classList.remove('listening', 'speaking', 'thinking');

  if (state === 'idle') {
    statusEl.textContent = 'STANDBY';
    statusEl.style.color = 'var(--cyan)';
  } else if (state === 'listening') {
    listeningState = true;
    orb.classList.add('listening');
    statusEl.textContent = 'LISTENING';
    statusEl.style.color = '#00ff88';
  } else if (state === 'speaking') {
    speakingState = true;
    orb.classList.add('speaking');
    statusEl.textContent = 'SPEAKING';
    statusEl.style.color = '#ffd700';
  } else if (state === 'thinking') {
    thinkingState = true;
    orb.classList.add('thinking');
    statusEl.textContent = 'PROCESSING';
    statusEl.style.color = '#c090ff';
  }
}


// ── Chat messages ─────────────────────────────
let cmdCount = 0;
const msgsEl = document.getElementById('chat-msgs');

function addMsg(type, text) {
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + type;

  if (type === 'user' || type === 'friday') {
    const lbl = document.createElement('div');
    lbl.className = 'msg-label';
    lbl.textContent = type === 'user' ? '◆ YOU' : '▶ FRIDAY';
    wrap.appendChild(lbl);
    if (type === 'user') {
      cmdCount++;
      document.getElementById('m-cmds').textContent = cmdCount;
    }
  }

  const txt = document.createElement('div');
  txt.textContent = text;
  wrap.appendChild(txt);
  msgsEl.appendChild(wrap);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}


// ── Web Speech — voice output ─────────────────
const synth = window.speechSynthesis;
let fridayVoice = null;

function loadVoices() {
  const voices = synth.getVoices();
  const preferred = ['Samantha', 'Karen', 'Moira', 'Fiona', 'Sonia', 'Aria', 'Jenny', 'Zira'];
  for (const name of preferred) {
    const v = voices.find(v => v.name.includes(name));
    if (v) { fridayVoice = v; break; }
  }
  if (!fridayVoice) fridayVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
  if (fridayVoice) document.getElementById('voice-label').textContent = fridayVoice.name.toUpperCase();
}
synth.onvoiceschanged = loadVoices;
loadVoices();

function speak(text) {
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  if (fridayVoice) utt.voice = fridayVoice;
  utt.rate = 0.95; utt.pitch = 1.0; utt.volume = 1.0;
  utt.onstart = () => setState('speaking');
  utt.onend   = () => setState('idle');
  utt.onerror = () => setState('idle');
  synth.speak(utt);
}


// ── Gemini AI ─────────────────────────────────
const conversationHistory = [];

async function askGemini(userMessage) {
  if (!GEMINI_API_KEY) {
    return 'Please enter your Gemini API key using the panel above, sir.';
  }

  conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] });

  try {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: conversationHistory,
        generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
      })
    });

    const data = await res.json();

    if (data.error) {
      conversationHistory.pop();
      const msg = data.error.message || 'Unknown error';
      if (data.error.code === 400 || data.error.code === 403) {
        return 'My API key appears to be invalid, sir. Please re-enter it.';
      }
      return `Gemini returned an error, sir: ${msg}`;
    }

    const reply = data.candidates[0].content.parts[0].text.trim();
    conversationHistory.push({ role: 'model', parts: [{ text: reply }] });
    return reply;

  } catch (e) {
    conversationHistory.pop();
    return `I can't reach my brain right now, sir. Error: ${e.message}`;
  }
}


// ── Built-in skills ───────────────────────────
const SITES = {
  youtube:   'https://youtube.com',
  google:    'https://google.com',
  github:    'https://github.com',
  gmail:     'https://mail.google.com',
  instagram: 'https://instagram.com',
  twitter:   'https://twitter.com',
  reddit:    'https://reddit.com',
  netflix:   'https://netflix.com',
  whatsapp:  'https://web.whatsapp.com',
  spotify:   'https://open.spotify.com',
  amazon:    'https://amazon.in',
};

async function process(command) {
  if (!command.trim()) return;
  const cmd = command.trim().toLowerCase();
  const sendBtn = document.getElementById('send-btn');
  sendBtn.disabled = true;

  // Time
  if (cmd.includes('time')) {
    const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const reply = `It's ${t}, sir.`;
    addMsg('friday', reply); speak(reply);
    sendBtn.disabled = false; return;
  }

  // Date
  if (cmd.includes('date') || cmd.includes('today')) {
    const d = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const reply = `Today is ${d}, sir.`;
    addMsg('friday', reply); speak(reply);
    sendBtn.disabled = false; return;
  }

  // Open websites
  for (const [site, url] of Object.entries(SITES)) {
    if (cmd.includes(site)) {
      const reply = `Opening ${site.charAt(0).toUpperCase() + site.slice(1)}, sir.`;
      addMsg('friday', reply); speak(reply);
      setTimeout(() => window.open(url, '_blank'), 800);
      sendBtn.disabled = false; return;
    }
  }

  // Search
  if (cmd.includes('search') || cmd.includes('look up')) {
    const query = cmd.replace('search', '').replace('look up', '').trim();
    if (query) {
      const reply = `Searching for ${query}, sir.`;
      addMsg('friday', reply); speak(reply);
      setTimeout(() => window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank'), 800);
    }
    sendBtn.disabled = false; return;
  }

  // Play on YouTube
  if (cmd.includes('play')) {
    const query = cmd.replace('play', '').replace('on youtube', '').trim();
    if (query) {
      const reply = `Playing ${query} on YouTube, sir.`;
      addMsg('friday', reply); speak(reply);
      setTimeout(() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank'), 800);
    }
    sendBtn.disabled = false; return;
  }

  // Clear memory
  if ((cmd.includes('clear') && cmd.includes('memory')) || cmd.includes('forget')) {
    conversationHistory.length = 0;
    const reply = 'Memory cleared, sir. Fresh start.';
    addMsg('friday', reply); speak(reply);
    sendBtn.disabled = false; return;
  }

  // Help
  if (cmd.includes('help') || cmd.includes('what can you do')) {
    const reply = 'I can open websites, search Google, play YouTube, tell the time and date, and answer questions using Gemini AI, sir.';
    addMsg('friday', reply); speak(reply);
    sendBtn.disabled = false; return;
  }

  // Fallback → Gemini AI
  setState('thinking');
  const reply = await askGemini(command);
  setState('idle');
  addMsg('friday', reply);
  speak(reply);
  sendBtn.disabled = false;
}


// ── Chat input ────────────────────────────────
const chatInput = document.getElementById('chat-input');
const sendBtn   = document.getElementById('send-btn');

function submit() {
  const v = chatInput.value.trim();
  if (!v) return;
  addMsg('user', v);
  chatInput.value = '';
  process(v);
}
sendBtn.addEventListener('click', submit);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });


// ── Voice input (mic) ─────────────────────────
const micBtn = document.getElementById('mic-btn');
let recognition = null;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart  = () => { micBtn.classList.add('active'); setState('listening'); };
  recognition.onend    = () => { micBtn.classList.remove('active'); setState('idle'); };
  recognition.onerror  = () => { micBtn.classList.remove('active'); setState('idle'); };
  recognition.onresult = e => {
    const text = e.results[0][0].transcript;
    addMsg('user', text);
    process(text);
  };

  micBtn.addEventListener('click', () => {
    if (micBtn.classList.contains('active')) recognition.stop();
    else { synth.cancel(); recognition.start(); }
  });
} else {
  micBtn.title = 'Voice input not supported in this browser';
  micBtn.style.opacity = '0.3';
}


// ── Clock & uptime ────────────────────────────
const startTime = Date.now();

function updateClock() {
  const now = new Date();
  document.getElementById('m-time').textContent =
    String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const e = Math.floor((Date.now() - startTime) / 1000);
  document.getElementById('m-uptime').textContent =
    String(Math.floor(e / 60)).padStart(2, '0') + ':' + String(e % 60).padStart(2, '0');
}
setInterval(updateClock, 1000);
updateClock();


// ── Boot sequence ─────────────────────────────
const bootLines = [
  'STARK INDUSTRIES AI FRAMEWORK v4.1',
  'Initializing web interface...',
  'Loading Gemini inference engine...',
  'Web Speech API: online',
  'All systems nominal.',
  'Greetings, sir.',
];

const bootEl  = document.getElementById('boot-lines');
const overlay = document.getElementById('boot-overlay');
let bi = 0;

function bootStep() {
  if (bi >= bootLines.length) {
    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.style.display = 'none'; setState('idle'); }, 800);
      addMsg('sys', 'System online');
      if (GEMINI_API_KEY) {
        setTimeout(() => speak('Greetings, sir. Friday is online and ready.'), 500);
      }
    }, 400);
    return;
  }
  const line = document.createElement('div');
  line.className = 'boot-line';
  line.textContent = '> ' + bootLines[bi++];
  bootEl.appendChild(line);
  setTimeout(bootStep, bi < bootLines.length ? 310 : 600);
}

setTimeout(bootStep, 300);
