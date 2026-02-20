#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Запуск ремонтной службы  ${NC}"
echo -e "${BLUE}========================================${NC}"

# Функция для проверки команды
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 не установлен${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $1 установлен${NC}"
        return 0
    fi
}

# Функция для проверки порта
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}❌ Порт $1 уже используется${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Порт $1 свободен${NC}"
        return 0
    fi
}

# Функция для остановки процессов
cleanup() {
    echo -e "\n${YELLOW}🛑 Остановка сервисов...${NC}"
    
    # Убиваем процессы
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    
    # Убиваем все процессы node, связанные с проектом
    pkill -f "nest" 2>/dev/null
    pkill -f "react-scripts" 2>/dev/null
    pkill -f "ts-node" 2>/dev/null
    
    echo -e "${GREEN}✅ Сервисы остановлены${NC}"
    exit 0
}

# Устанавливаем обработчик Ctrl+C
trap cleanup SIGINT SIGTERM

echo -e "\n${YELLOW}🔍 Проверка системы...${NC}"

# Проверяем Node.js
check_command node
if [ $? -ne 0 ]; then
    echo -e "${RED}Установите Node.js: sudo apt install -y nodejs${NC}"
    exit 1
fi

# Проверяем npm
check_command npm

# Проверяем порты
check_port 3000
check_port 3001

# Создаем папку для базы данных
mkdir -p data

echo -e "\n${YELLOW}📦 Настройка backend...${NC}"

# Переходим в корневую папку
cd ~/repair-requests

# Устанавливаем зависимости если нужно
if [ ! -d "node_modules" ]; then
    echo "📥 Установка зависимостей backend..."
    npm install
fi

# Запускаем миграции
echo "🔄 Запуск миграций..."
npm run migration:run

# Запускаем сиды
echo "🌱 Заполнение базы данных..."
npm run seed

# Запускаем backend
echo "🚀 Запуск backend сервера..."
npm run start:dev > backend.log 2>&1 &
BACKEND_PID=$!

# Ждем запуска backend
echo -n "⏳ Ожидание запуска backend"
for i in {1..15}; do
    sleep 1
    echo -n "."
    if curl -s http://localhost:3001/api/requests > /dev/null 2>&1; then
        echo -e "\n${GREEN}✅ Backend запущен на http://localhost:3001${NC}"
        BACKEND_READY=true
        break
    fi
done

if [ "$BACKEND_READY" != true ]; then
    echo -e "\n${RED}❌ Не удалось запустить backend${NC}"
    echo "Проверьте логи: cat backend.log"
    cleanup
    exit 1
fi

echo -e "\n${YELLOW}🎨 Настройка frontend...${NC}"

# Переходим в папку клиента
cd client

# Устанавливаем зависимости если нужно
if [ ! -d "node_modules" ]; then
    echo "📥 Установка зависимостей frontend..."
    npm install --legacy-peer-deps
fi

# Запускаем frontend
echo "🚀 Запуск frontend сервера..."
BROWSER=none npm start > frontend.log 2>&1 &
FRONTEND_PID=$!

# Ждем немного для запуска frontend
sleep 5

echo -e "${GREEN}✅ Frontend запускается...${NC}"

cd ..

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Приложение успешно запущено!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}📱 Доступные адреса:${NC}"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:3001/api"
echo "   Backend лог: cat backend.log"
echo "   Frontend лог: cat client/frontend.log"
echo ""
echo -e "${YELLOW}👤 Тестовые пользователи:${NC}"
echo "   Диспетчер: dispatcher / password"
echo "   Мастер 1:  master1 / password"
echo "   Мастер 2:  master2 / password"
echo ""
echo -e "${YELLOW}🔄 Для тестирования гонки:${NC}"
echo "   ./race_test.sh"
echo ""
echo -e "${RED}🛑 Для остановки нажмите Ctrl+C${NC}"
echo ""

# Ждем сигнала остановки
while true; do
    sleep 1
done
