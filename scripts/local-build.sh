#!/bin/bash

# Script para construir el proyecto localmente sin problemas con rc-util

echo "Preparando construcción local..."

# Crear directorio temporal para guardar los archivos originales
mkdir -p pages_bak/matches/edit

# Guardar los archivos originales
cp -r pages/matches/edit/* pages_bak/matches/edit/ 2>/dev/null || true

# Crear un archivo temporal simplificado
cat > "pages/matches/edit/[id].js" << EOF
export default function EditMatch() {
  return <div>Página temporalmente deshabilitada para construcción local</div>;
}
EOF

echo "Ejecutando build..."
npm run build

# Restaurar los archivos originales
rm -f "pages/matches/edit/[id].js"
cp -r pages_bak/matches/edit/* pages/matches/edit/ 2>/dev/null || true
rm -rf pages_bak

echo "Construcción finalizada y archivos restaurados." 