const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'whatspanda', 'Chat.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('fetchConversations')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
