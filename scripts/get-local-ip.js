#!/usr/bin/env node

const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      // Skip over internal (i.e. 127.0.0.1) and non-IPv4 addresses
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }

  return 'localhost';
}

const localIP = getLocalIP();

if (process.argv.includes('--update-env')) {
  const fs = require('fs');
  const path = require('path');

  const envFile = path.join(__dirname, '..', '.env.android.dev');

  if (fs.existsSync(envFile)) {
    let content = fs.readFileSync(envFile, 'utf8');

    // Replace IP addresses in the content
    content = content.replace(
      /http:\/\/\d+\.\d+\.\d+\.\d+:3000/g,
      `http://${localIP}:3000`
    );

    fs.writeFileSync(envFile, content);
    console.log(`✅ IP actualizada en .env.android.dev: ${localIP}`);
  } else {
    console.log('❌ Archivo .env.android.dev no encontrado');
  }
} else {
  console.log(localIP);
}
