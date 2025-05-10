const fs = require('fs');

// Leer el archivo
const filePath = './pages/group/[id].tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Mostrar las líneas alrededor de las menciones relevantes
function showContext(lineNumber, radius = 10) {
  console.log(`\n===== Contexto alrededor de línea ${lineNumber} =====`);
  const start = Math.max(0, lineNumber - radius - 1);
  const end = Math.min(lines.length - 1, lineNumber + radius - 1);

  for (let i = start; i <= end; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}

// Buscar lugares relevantes
console.log("== Buscando 'group.nextMatchDetails?.confirmedPlayers' ==");
lines.forEach((line, index) => {
  if (line.includes('group.nextMatchDetails?.confirmedPlayers')) {
    console.log(`Línea ${index + 1}: ${line}`);
  }
});

console.log("\n== Buscando 'confirmedCount' ==");
lines.forEach((line, index) => {
  if (line.includes('confirmedCount')) {
    console.log(`Línea ${index + 1}: ${line}`);
  }
});

// Mostrar contexto alrededor de líneas importantes
showContext(2352, 10); // Línea que contiene ": `Sortear equipos (${"
showContext(1946, 10); // Línea que contiene "Sortear equipos ({confirmedPlayersCount}"
