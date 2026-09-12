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

function handleAnalyze() {
  const text = document.getElementById('requestInput').value;
  try {
    const result = window.TriageEngine.triage(text);
    renderResult(result);
  } catch (err) {
    alert(err.message);
  }
}

function init() {
  populateExamples();
  document.getElementById('analyzeBtn').addEventListener('click', handleAnalyze);
  document.getElementById('copyResponseBtn').addEventListener('click', () => {
    const textarea = document.getElementById('responseText');
    textarea.select();
    navigator.clipboard.writeText(textarea.value).catch(() => document.execCommand('copy'));
  });
}

document.addEventListener('DOMContentLoaded', init);
