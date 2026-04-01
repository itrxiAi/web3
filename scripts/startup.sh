#!/bin/bash

# Set base directory
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 检查端口占用情况
check_port() {
    local port=$1
    netstat -tuln | grep ":$port " >/dev/null
    return $?
}

# 找到可用端口
PORT=3000  # 直接使用 3001，因为我们知道这个端口可用
echo "Using port: $PORT"

# 先清理旧进程
pm2 delete hak 2>/dev/null || true

# 启动项目
cd "$BASE_DIR/web3" || exit
# 使用 PM2 启动 Next.js 应用，使用找到的可用端口
export PORT=$PORT
pm2 start npm --name "hak" -- start -- -p $PORT

# 等待 Next.js 应用启动
echo "Waiting for Next.js to start..."
sleep 10

pm2 status

# 显示端口信息
echo -e "\nPort information:"
echo "Next.js running on port: $PORT"

# 提供查看日志的命令
echo -e "\nTo view logs in real-time, use:"
echo "PM2 logs: pm2 logs hak"

# curl --location "http://localhost:$PORT/api/admin/task" \
# --header 'Content-Type: application/json' \
# --header "Authorization: Bearer $AUTH_BEARER" \
# --data '{
#     "func":""
# }'