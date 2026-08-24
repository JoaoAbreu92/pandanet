const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('react-icons/fa') || content.includes('import * as Fa')) {
        console.log(`Found in: ${fullPath}`);
      }
    }
  }
}

searchDir(path.join(__dirname, 'components'));
searchDir(path.join(__dirname, 'whatsapp-backend'));
