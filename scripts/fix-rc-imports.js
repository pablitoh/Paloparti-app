#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path to the problematic file
const dayjs_path = path.resolve(
  './node_modules/rc-picker/es/generate/dayjs.js'
);

try {
  console.log('Trying to fix rc-picker imports...');

  if (fs.existsSync(dayjs_path)) {
    let content = fs.readFileSync(dayjs_path, 'utf8');

    // Fix the import path
    const fixedContent = content.replace(
      "import warning from 'rc-util/es/warning';",
      "import warning from 'rc-util/es/warning.js';"
    );

    // Write the fixed content back
    fs.writeFileSync(dayjs_path, fixedContent);

    console.log('Fixed rc-picker import successfully!');
  } else {
    console.log('File not found:', dayjs_path);
  }
} catch (error) {
  console.error('Error fixing imports:', error);
}
