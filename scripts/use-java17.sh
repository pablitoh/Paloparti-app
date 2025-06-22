#!/bin/bash

# Script para usar Java 17 para Android development
# Uso: source scripts/use-java17.sh

export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH=$JAVA_HOME/bin:$PATH

echo "✅ Cambiado a Java 17 para Android:"
echo "JAVA_HOME: $JAVA_HOME"
java -version 