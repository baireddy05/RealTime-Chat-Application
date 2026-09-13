const fs = require('fs');
const content = fs.readFileSync('C:/Users/rithw/.gemini/antigravity-ide/brain/d779bc60-5c82-4f21-8193-1f7b5bb1bc96/scratch/stitch_input.html', 'utf8');

function showSection(name, startStr, endStr, maxLen = 4000) {
  const s = content.indexOf(startStr);
  if (s === -1) {
    console.log('NOT FOUND: ' + startStr);
    return;
  }
  const e = endStr ? content.indexOf(endStr, s) : s + maxLen;
  console.log('=== ' + name + ' ===');
  console.log(content.slice(s, (e !== -1 ? e : s + maxLen)).slice(0, maxLen));
}

const arg = process.argv[2] || 'aside';

if (arg === 'aside') {
  showSection('ASIDE NAVIGATION', '<aside', '</aside>');
} else if (arg === 'header') {
  showSection('HEADER', '<header', '</header>');
} else if (arg === 'sidebar') {
  showSection('CONVERSATION SIDEBAR', '<!-- LEFT PANEL: Conversation Sidebar (xl:col-span-4) -->', '<!-- RIGHT PANEL: Master Active Conversation Viewport (xl:col-span-8) -->');
} else if (arg === 'chatpane') {
  showSection('CHAT PANE', '<!-- RIGHT PANEL: Master Active Conversation Viewport (xl:col-span-8) -->', '<!-- Footer Protocol Metadata -->');
} else if (arg === 'statusmodal') {
  showSection('STATUS MODAL', '<!-- Center Modal: \'Set Status Mood\' -->', '<!-- Overlay Card: \'Message Info & E2EE Read Receipts\' -->');
} else if (arg === 'infomodal') {
  showSection('INFO MODAL', '<!-- Overlay Card: \'Message Info & E2EE Read Receipts\' -->', '<!-- RIGHT PANEL (4 Cols): Contextual Thread Drawer -->');
}
