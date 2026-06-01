// ===== STATE =====
let currentMode = 'simple';
let generatedText = '';

// ===== INIT =====
document.getElementById('explain-btn').addEventListener('click', explain);
document.getElementById('copy-btn').addEventListener('click', copyOutput);
document.getElementById('clear-btn').addEventListener('click', clearOutput);
document.getElementById('clear-input-btn').addEventListener('click', clearInput);
document.getElementById('sample-btn').addEventListener('click', loadSample);

// Mode buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
  });
});

// ===== SAMPLE CODE =====
function loadSample() {
  document.getElementById('code-input').value =
`async function fetchUserData(userId) {
  try {
    const response = await fetch(\`/api/users/\${userId}\`);
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}`;
  document.getElementById('lang').value = 'javascript';
}

// ===== LOADING MESSAGES =====
const loadMsgs = {
  simple:  ['Reading your code...', 'Finding key concepts...', 'Writing explanation...'],
  lineby:  ['Parsing each line...', 'Analyzing logic...', 'Building breakdown...'],
  eli5:    ['Thinking of analogies...', 'Making it super simple...', 'Almost done...'],
  senior:  ['Analyzing patterns...', 'Checking best practices...', 'Writing technical notes...']
};

let msgTimer = null;
function startMsgs() {
  const msgs = loadMsgs[currentMode] || loadMsgs.simple;
  let i = 0;
  document.getElementById('loading-msg').textContent = msgs[0];
  msgTimer = setInterval(() => {
    i = (i + 1) % msgs.length;
    document.getElementById('loading-msg').textContent = msgs[i];
  }, 1400);
}
function stopMsgs() { clearInterval(msgTimer); }

// ===== EXPLAIN =====
async function explain() {
  const apiKey = document.getElementById('api-key').value.trim();
  const code   = document.getElementById('code-input').value.trim();
  const lang   = document.getElementById('lang').value;
  clearError();

  if (!apiKey) { showError('Please enter your Groq API key.'); return; }
  if (!code)   { showError('Please paste some code first.'); return; }

  const btn = document.getElementById('explain-btn');
  btn.disabled = true;
  showLoading(true);
  startMsgs();
  document.getElementById('output-panel').style.display = 'none';

  const langText = lang === 'auto' ? 'auto-detect the language' : `treat it as ${lang}`;

  const prompts = {
    simple: `Explain this code in simple, clear English. ${langText}.

Structure your response as:
## 🎯 What This Code Does
(1-2 sentence summary)

## 🔑 Key Concepts
(bullet points of main ideas)

## 🔄 How It Works
(step by step walkthrough)

## ⚠️ Important Notes
(any gotchas or things to know)

Code:
\`\`\`
${code}
\`\`\``,

    lineby: `Explain this code line by line. ${langText}.

First give a ## 🎯 Overview (2-3 sentences).

Then create a markdown table with columns "Code" and "Explanation" — put each meaningful line or block in the Code column and a plain English explanation in the Explanation column.

Then add ## 💡 Summary of what the whole thing does together.

Code:
\`\`\`
${code}
\`\`\``,

    eli5: `Explain this code like I am 5 years old. Use simple words, fun analogies, and real-world comparisons. No technical jargon. ${langText}.

Structure:
## 🧸 The Simple Version
(explain like a story or analogy)

## 🎯 What It Actually Does
(still simple but slightly more accurate)

## 🌟 Cool Thing About It
(one interesting observation)

Code:
\`\`\`
${code}
\`\`\``,

    senior: `You are a senior developer doing a code review. ${langText}. Analyze this code technically.

Structure:
## 🏗️ Architecture & Pattern
(what pattern/paradigm is used)

## ⚙️ Technical Breakdown
(detailed technical explanation)

## ✅ What's Done Well
(good practices observed)

## 🔧 Potential Improvements
(suggestions for better code)

## 🚨 Edge Cases & Risks
(what could go wrong)

Code:
\`\`\`
${code}
\`\`\``
  };

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompts[currentMode] }]
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'API request failed');
    }

    const data = await res.json();
    generatedText = data.choices[0].message.content;

    // Render
    renderExplanation(generatedText);

    // Update badges
    const modeNames = { simple:'Simple', lineby:'Line by Line', eli5:'ELI5', senior:'Senior Dev' };
    document.getElementById('mode-badge').textContent = modeNames[currentMode];
    document.getElementById('lang-badge').textContent = lang === 'auto' ? '' : lang.toUpperCase();

    document.getElementById('output-panel').style.display = 'block';
    document.getElementById('output-panel').scrollIntoView({ behavior:'smooth', block:'nearest' });

  } catch (err) {
    showError('Error: ' + err.message);
  }

  stopMsgs();
  showLoading(false);
  btn.disabled = false;
}

// ===== RENDER =====
function renderExplanation(text) {
  const el = document.getElementById('explanation');

  let html = text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\s*<li>[\s\S]*?<\/li>)*/g, '<ul>$&</ul>');

  // Code blocks
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Tables — convert markdown table to HTML
  html = html.replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g, (match, header, rows) => {
    const ths = header.split('|').filter(s => s.trim()).map(s => `<th>${s.trim()}</th>`).join('');
    const trs = rows.trim().split('\n').map(row => {
      const tds = row.split('|').filter(s => s.trim()).map(s => `<td>${s.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    return `<table class="line-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  });

  // Wrap remaining lines in <p>
  html = html.replace(/^(?!<[hupbt]).+$/gm, '<p>$&</p>');
  html = html.replace(/<p><\/p>/g, '');

  el.innerHTML = html;
}

// ===== COPY =====
function copyOutput() {
  navigator.clipboard.writeText(generatedText).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
  });
}

// ===== CLEAR =====
function clearOutput() {
  generatedText = '';
  document.getElementById('output-panel').style.display = 'none';
  document.getElementById('explanation').innerHTML = '';
  clearError();
}

function clearInput() {
  document.getElementById('code-input').value = '';
  clearError();
}

// ===== HELPERS =====
function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
}
function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.add('show');
}
function clearError() {
  const el = document.getElementById('error-msg');
  el.textContent = '';
  el.classList.remove('show');
}
