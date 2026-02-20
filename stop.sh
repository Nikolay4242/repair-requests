#!/bin/bash
echo "🛑 Останавливаем сервисы..."
pkill -f "nest"
pkill -f "react-scripts"
pkill -f "ts-node"
echo "✅ Сервисы остановлены"
