/**
 * app.js — wires the UI to TriageEngine. No framework, no build step.
 */

const MOCK_REQUESTS = [
  'Our team has 40 employees entering the same customer details into three systems. Could you show us how this might be automated? We would like to speak next week.',
  'The client portal has been unavailable since this morning and our staff cannot access active customer records. Please help as soon as possible.',
  'Invoice NS-1048 appears to include the same implementation charge twice. Can someone review it before payment is processed Friday?',
  'Can you add dark mode and change the dashboard font? There is no deadline. I am collecting ideas for a future update.',
  'We accidentally uploaded a spreadsheet containing customer contact information to the wrong workspace. We need immediate help removing access.',
  'I saw your company online and am interested in a custom AI reporting system. What would pricing and a typical timeline look like?'
];

const API_KEY_STORAGE_KEY = 'triage_openai_key';

function populateExamples() {
  const select = document.getElementById('exampleSelect');
  MOCK_REQUESTS.forEach((text, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `Mock request ${String(i + 1).padStart(2, '0')}`;
    select.appendChild(option);
  });
  select.addEventListener('change', () => {
    if (select.value !== '') {
      document.getElementById('requestInput').value = MOCK_REQUESTS[Number(select.value)];
    }
  });
}

function renderResult(result) {
  const panel = document.getElementById('resultsPanel');
  panel.hidden = false;

  const categoryBadge = document.getElementById('categoryBadge');
  categoryBadge.textContent = `Category: ${result.category}`;

  const priorityBadge = document.getElementById('priorityBadge');
  priorityBadge.textContent = `Priority: ${result.priority}`;
  priorityBadge.className = `badge priority-${result.priority.toLowerCase()}`;

  document.getElementById('ownerBadge').textContent = `Owner: ${result.owner}`;
  document.getElementById('summaryText').textContent = result.summary;
  document.getElementById('priorityReasonText').textContent = result.priorityReason;
  document.getElementById('responseText').value = result.response;
}

function getSavedApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch (e) {
    return '';
  }
}

// Purely stylistic pass: never allowed to change category/priority/owner, only wording.
async function enhanceWithAI(result, originalText) {
  const apiKey = getSavedApiKey();
  if (!apiKey) return result;

  try {
    const prompt = 'You are polishing wording only. Do not change facts, category, priority, or owner.\n' +
      'Original client request: "' + originalText + '"\n' +
      'Current summary: "' + result.summary + '"\n' +
      'Current draft response: "' + result.response + '"\n\n' +
      'Return JSON with keys "summary" and "response" containing more natural, professional wording.';

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) throw new Error(`OpenAI request failed: ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      ...result,
      summary: parsed.summary || result.summary,
      response: parsed.response || result.response
    };
  } catch (err) {
    console.warn('AI enhancement skipped:', err.message);
    return result;
  }
}

async function handleAnalyze() {
  const text = document.getElementById('requestInput').value;
  const btn = document.getElementById('analyzeBtn');
  try {
    btn.disabled = true;
    btn.textContent = 'Analyzing...';
    let result = window.TriageEngine.triage(text);
    result = await enhanceWithAI(result, text);
    renderResult(result);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analyze Request';
  }
}

function setupApiKeyControls() {
  const input = document.getElementById('apiKeyInput');
  const status = document.getElementById('keyStatus');
  const existing = getSavedApiKey();
  if (existing) status.textContent = 'Key saved in this browser.';

  document.getElementById('saveKeyBtn').addEventListener('click', () => {
    const value = input.value.trim();
    if (!value) return;
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, value);
      status.textContent = 'Key saved in this browser.';
      input.value = '';
    } catch (e) {
      status.textContent = 'Could not save key (storage unavailable).';
    }
  });

  document.getElementById('clearKeyBtn').addEventListener('click', () => {
    try {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      status.textContent = 'Key cleared.';
    } catch (e) {
      // ignore
    }
  });
}

function init() {
  populateExamples();
  setupApiKeyControls();
  document.getElementById('analyzeBtn').addEventListener('click', handleAnalyze);
  document.getElementById('copyResponseBtn').addEventListener('click', () => {
    const textarea = document.getElementById('responseText');
    textarea.select();
    navigator.clipboard.writeText(textarea.value).catch(() => document.execCommand('copy'));
  });
}

document.addEventListener('DOMContentLoaded', init);
