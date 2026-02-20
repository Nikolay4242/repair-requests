#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  ТЕСТ ГОНКИ: Взять в работу  ${NC}"
echo -e "${BLUE}========================================${NC}"

# Базовая URL
API_URL="http://localhost:3001/api"

# Проверяем, запущен ли backend
if ! curl -s "$API_URL/requests" > /dev/null; then
    echo -e "${RED}❌ Backend не запущен!${NC}"
    echo "Запустите сначала: ./simple-start.sh"
    exit 1
fi

# Проверяем наличие jq
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️ jq не установлен. Устанавливаем...${NC}"
    sudo apt update && sudo apt install -y jq
fi

# Функция для логина и получения токена
login() {
    local username=$1
    local password=$2
    
    response=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\"}")
    
    echo "$response" | jq -r '.access_token'
}

# Функция для создания тестовой заявки
create_test_request() {
    local token=$1
    
    response=$(curl -s -X POST "$API_URL/requests" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d '{
            "clientName": "Тестовый Клиент",
            "phone": "+79161234567",
            "address": "ул. Тестовая, д. 1",
            "problemText": "Тестовая проблема для проверки гонки"
        }')
    
    echo "$response" | jq -r '.id'
}

# Функция для получения списка мастеров
get_masters() {
    local token=$1
    
    # Временное решение - используем предопределенных мастеров
    echo "1"  # ID первого мастера
}

# Функция для назначения мастера
assign_master() {
    local token=$1
    local requestId=$2
    local masterId=$3
    
    curl -s -X PATCH "$API_URL/requests/$requestId/assign" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{\"masterId\": $masterId}" > /dev/null
}

# Функция для попытки взять в работу
take_to_work() {
    local token=$1
    local requestId=$2
    local threadNum=$3
    
    response=$(curl -s -w "\n%{http_code}" -X PATCH \
        "$API_URL/requests/$requestId/take-to-work" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d '{}')
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "200" ]; then
        echo -e "${GREEN}[Поток $threadNum] ✅ УСПЕХ - Заявка взята в работу${NC}"
        return 0
    elif [ "$status_code" = "409" ]; then
        message=$(echo "$body" | jq -r '.message' 2>/dev/null || echo "$body")
        echo -e "${RED}[Поток $threadNum] 🔴 КОНФЛИКТ - $message${NC}"
        return 1
    else
        echo -e "${YELLOW}[Поток $threadNum] ⚠️  ОШИБКА - Код $status_code${NC}"
        return 2
    fi
}

# Основной тест
echo -e "\n${YELLOW}1. Получаем токены...${NC}"

# Логинимся как диспетчер
DISPATCHER_TOKEN=$(login "dispatcher" "password")
if [ -z "$DISPATCHER_TOKEN" ] || [ "$DISPATCHER_TOKEN" = "null" ]; then
    echo -e "${RED}❌ Не удалось получить токен диспетчера${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Диспетчер авторизован${NC}"

# Логинимся как мастер
MASTER_TOKEN=$(login "master1" "password")
if [ -z "$MASTER_TOKEN" ] || [ "$MASTER_TOKEN" = "null" ]; then
    echo -e "${RED}❌ Не удалось получить токен мастера${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Мастер авторизован${NC}"

echo -e "\n${YELLOW}2. Создаем тестовую заявку...${NC}"
REQUEST_ID=$(create_test_request "$DISPATCHER_TOKEN")
if [ -z "$REQUEST_ID" ] || [ "$REQUEST_ID" = "null" ]; then
    echo -e "${RED}❌ Не удалось создать заявку${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Создана заявка ID: $REQUEST_ID${NC}"

echo -e "\n${YELLOW}3. Назначаем мастера на заявку...${NC}"
MASTER_ID=1  # ID первого мастера
assign_master "$DISPATCHER_TOKEN" "$REQUEST_ID" "$MASTER_ID"
echo -e "${GREEN}✅ Мастер назначен${NC}"

echo -e "\n${YELLOW}4. Запускаем 10 параллельных запросов 'Взять в работу'...${NC}"
echo -e "${BLUE}----------------------------------------${NC}"

# Запускаем параллельные запросы
declare -a pids
success_count=0
conflict_count=0
error_count=0

for i in {1..10}; do
    take_to_work "$MASTER_TOKEN" "$REQUEST_ID" $i &
    pids[$i]=$!
    sleep 0.1  # Небольшая задержка между запусками
done

# Ждем завершения всех фоновых процессов
for pid in ${pids[*]}; do
    wait $pid
    result=$?
    case $result in
        0) ((success_count++));;
        1) ((conflict_count++));;
        *) ((error_count++));;
    esac
done

echo -e "${BLUE}----------------------------------------${NC}"
echo -e "\n${YELLOW}5. Результаты:${NC}"
echo -e "${GREEN}✅ Успешных запросов: $success_count${NC}"
echo -e "${RED}🔴 Конфликтов: $conflict_count${NC}"
echo -e "${YELLOW}⚠️ Ошибок: $error_count${NC}"

# Проверяем финальный статус
echo -e "\n${YELLOW}6. Проверка финального статуса...${NC}"
FINAL_STATUS=$(curl -s -X GET "$API_URL/requests/$REQUEST_ID" \
    -H "Authorization: Bearer $MASTER_TOKEN" | jq -r '.status')

if [ "$FINAL_STATUS" = "in_progress" ]; then
    echo -e "${GREEN}✅ Финальный статус: $FINAL_STATUS (корректно)${NC}"
    TEST_RESULT="ПРОЙДЕН"
else
    echo -e "${RED}❌ Финальный статус: $FINAL_STATUS (ошибка)${NC}"
    TEST_RESULT="НЕ ПРОЙДЕН"
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}Тест гонки: $TEST_RESULT${NC}"
echo -e "${BLUE}========================================${NC}"

# Если тест пройден, показываем статистику
if [ "$success_count" -eq 1 ] && [ "$conflict_count" -eq 9 ]; then
    echo -e "\n${GREEN}✅ Защита от гонок работает корректно!${NC}"
    echo "   Только один запрос из 10 успешен, остальные получают 409 Conflict"
else
    echo -e "\n${YELLOW}⚠️ Результат отличается от ожидаемого${NC}"
    echo "   Ожидалось: 1 успех, 9 конфликтов"
fi
