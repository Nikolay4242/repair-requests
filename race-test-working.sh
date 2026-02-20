#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}     ТЕСТ ЗАЩИТЫ ОТ ГОНОК     ${NC}"
echo -e "${BLUE}========================================${NC}"

API_URL="http://localhost:3002/api"

# Проверка бэкенда
echo -e "\n${YELLOW}Проверка подключения...${NC}"
if curl -s "$API_URL/test" > /dev/null; then
    echo -e "${GREEN}✅ Бэкенд доступен${NC}"
else
    echo -e "${RED}❌ Бэкенд не отвечает на порту 3002${NC}"
    echo "   Запустите: node simple-backend-final.js"
    exit 1
fi

# Функция логина
login() {
    local user=$1
    local pass=$2
    curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$user\",\"password\":\"$pass\"}" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4
}

# 1. Логинимся как диспетчер
echo -e "\n${YELLOW}1. Авторизация диспетчера...${NC}"
DISP_TOKEN=$(login "dispatcher" "password")
if [ -n "$DISP_TOKEN" ]; then
    echo -e "${GREEN}   ✅ Диспетчер авторизован${NC}"
else
    echo -e "${RED}   ❌ Ошибка авторизации диспетчера${NC}"
    exit 1
fi

# 2. Создаем тестовую заявку
echo -e "\n${YELLOW}2. Создание тестовой заявки...${NC}"
RESPONSE=$(curl -s -X POST "$API_URL/requests" \
    -H "Authorization: Bearer $DISP_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "clientName": "Тест Гонки",
        "phone": "+79991234567",
        "address": "ул. Тестовая, 1",
        "problemText": "Тестирование защиты от гонок"
    }')

REQUEST_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$REQUEST_ID" ]; then
    echo -e "${GREEN}   ✅ Создана заявка ID: $REQUEST_ID${NC}"
else
    echo -e "${RED}   ❌ Ошибка создания заявки${NC}"
    echo "$RESPONSE"
    exit 1
fi

# 3. Назначаем мастера
echo -e "\n${YELLOW}3. Назначение мастера...${NC}"
curl -s -X PATCH "$API_URL/requests/$REQUEST_ID/assign" \
    -H "Authorization: Bearer $DISP_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"masterId":2}' > /dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}   ✅ Мастер назначен${NC}"
else
    echo -e "${RED}   ❌ Ошибка назначения мастера${NC}"
    exit 1
fi

# 4. Логинимся как мастер
echo -e "\n${YELLOW}4. Авторизация мастера...${NC}"
MASTER_TOKEN=$(login "master1" "password")
if [ -n "$MASTER_TOKEN" ]; then
    echo -e "${GREEN}   ✅ Мастер авторизован${NC}"
else
    echo -e "${RED}   ❌ Ошибка авторизации мастера${NC}"
    exit 1
fi

# 5. Запускаем параллельные запросы
echo -e "\n${YELLOW}5. Запуск 10 параллельных запросов...${NC}"
echo -e "${BLUE}----------------------------------------${NC}"

# Создаем временный файл для результатов
TMP_FILE=$(mktemp)

# Функция для одного запроса
send_request() {
    local num=$1
    local result_file=$2
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/requests/$REQUEST_ID/take-to-work" \
        -H "Authorization: Bearer $MASTER_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{}')
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    echo "$num:$HTTP_CODE" >> "$result_file"
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}[$num] ✅ УСПЕХ${NC}"
    elif [ "$HTTP_CODE" = "409" ]; then
        echo -e "${RED}[$num] 🔴 КОНФЛИКТ${NC}"
    else
        echo -e "${YELLOW}[$num] ⚠️ КОД $HTTP_CODE${NC}"
    fi
}

# Запускаем 10 параллельных запросов
for i in {1..10}; do
    send_request $i "$TMP_FILE" &
done

# Ждем завершения всех запросов
wait

echo -e "${BLUE}----------------------------------------${NC}"

# Анализируем результаты
SUCCESS=$(grep -c ":200$" "$TMP_FILE")
CONFLICT=$(grep -c ":409$" "$TMP_FILE")
OTHER=$(grep -c -v ":200\|:409" "$TMP_FILE")

echo -e "\n${YELLOW}6. Результаты теста:${NC}"
echo -e "   ${GREEN}✅ Успешных запросов: $SUCCESS${NC}"
echo -e "   ${RED}🔴 Конфликтов: $CONFLICT${NC}"
echo -e "   ${YELLOW}⚠️ Другие ошибки: $OTHER${NC}"

# Проверяем финальный статус
echo -e "\n${YELLOW}7. Проверка финального статуса заявки...${NC}"
FINAL_STATUS=$(curl -s -X GET "$API_URL/requests/$REQUEST_ID" \
    -H "Authorization: Bearer $MASTER_TOKEN" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$FINAL_STATUS" = "in_progress" ]; then
    echo -e "${GREEN}   ✅ Статус: $FINAL_STATUS (корректно)${NC}"
else
    echo -e "${RED}   ❌ Статус: $FINAL_STATUS (ошибка)${NC}"
fi

# Удаляем временный файл
rm -f "$TMP_FILE"

echo -e "\n${BLUE}========================================${NC}"
if [ "$SUCCESS" -eq 1 ] && [ "$CONFLICT" -eq 9 ]; then
    echo -e "${GREEN}✅ ТЕСТ ПРОЙДЕН! Защита от гонок работает корректно${NC}"
else
    echo -e "${YELLOW}⚠️ РЕЗУЛЬТАТ: ${SUCCESS} успехов, ${CONFLICT} конфликтов${NC}"
    echo -e "${YELLOW}   Ожидалось: 1 успех, 9 конфликтов${NC}"
fi
echo -e "${BLUE}========================================${NC}"

# Очищаем тестовую заявку (опционально)
# curl -s -X DELETE "$API_URL/requests/$REQUEST_ID" \
#     -H "Authorization: Bearer $DISP_TOKEN" > /dev/null
