#!/bin/bash
# 日志查看脚本 - 快速查看部署和服务日志

set -e

# 自动检测项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_DIR}" 2>/dev/null || {
    echo "错误: 无法进入项目目录 $PROJECT_DIR"
    echo "当前工作目录: $(pwd)"
    echo "脚本所在目录: $SCRIPT_DIR"
    exit 1
}

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 检测环境
DETECT_ENV() {
    if [ -d "/blog" ] && [ "$(pwd)" = "/blog/SiaBao-blog" ]; then
        echo "docker-compose -f docker-compose.prod.yml"
    else
        echo "docker compose"
    fi
}

COMPOSE_CMD=$(DETECT_ENV)

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Sia Blog 日志查看工具${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# 显示菜单
show_menu() {
    echo "请选择要查看的日志:"
    echo ""
    echo "  ${CYAN}[1]${NC} 查看所有服务日志 (实时)"
    echo "  ${CYAN}[2]${NC} 查看后端日志"
    echo "  ${CYAN}[3]${NC} 查看前端日志"
    echo "  ${CYAN}[4]${NC} 查看 Nginx 日志"
    echo "  ${CYAN}[5]${NC} 查看最近的部署日志"
    echo "  ${CYAN}[6]${NC} 查看容器状态"
    echo "  ${CYAN}[7]${NC} 查看资源使用情况"
    echo "  ${CYAN}[8]${NC} 查看错误日志 (所有服务)"
    echo "  ${CYAN}[0]${NC} 退出"
    echo ""
}

# 查看部署日志
view_deploy_log() {
    echo -e "${BLUE}--- 部署日志文件 ---${NC}"
    if [ -d "logs" ]; then
        local latest_log=$(ls -t logs/deploy_*.log 2>/dev/null | head -1)
        if [ -n "$latest_log" ]; then
            echo -e "最新部署日志: ${latest_log}"
            echo ""
            tail -50 "$latest_log"
            echo ""
            echo -e "${YELLOW}查看完整日志: tail -f $latest_log${NC}"
        else
            echo -e "${YELLOW}未找到部署日志${NC}"
        fi
    else
        echo -e "${YELLOW}logs 目录不存在${NC}"
    fi
}

# 查看错误日志
view_error_logs() {
    echo -e "${RED}--- 最近错误日志 ---${NC}"
    echo ""
    $COMPOSE_CMD logs --tail=100 2>&1 | grep -i --color=auto "error\|exception\|failed\|critical" || echo -e "${GREEN}未发现错误日志${NC}"
}

# 主循环
while true; do
    clear
    show_menu
    read -p "请输入选项 [0-8]: " choice

    case $choice in
        1)
            echo -e "${GREEN}--- 所有服务日志 (Ctrl+C 退出) ---${NC}"
            $COMPOSE_CMD logs -f --tail=50
            ;;
        2)
            echo -e "${GREEN}--- 后端服务日志 (Ctrl+C 退出) ---${NC}"
            $COMPOSE_CMD logs -f --tail=50 backend
            ;;
        3)
            echo -e "${GREEN}--- 前端服务日志 (Ctrl+C 退出) ---${NC}"
            $COMPOSE_CMD logs -f --tail=50 frontend
            ;;
        4)
            echo -e "${GREEN}--- Nginx 日志 (Ctrl+C 退出) ---${NC}"
            $COMPOSE_CMD logs -f --tail=50 nginx
            ;;
        5)
            view_deploy_log
            echo ""
            read -p "按 Enter 继续..."
            ;;
        6)
            echo -e "${CYAN}--- 容器状态 ---${NC}"
            $COMPOSE_CMD ps
            echo ""
            read -p "按 Enter 继续..."
            ;;
        7)
            echo -e "${CYAN}--- 资源使用情况 ---${NC}"
            docker stats --no-stream
            echo ""
            echo -e "${CYAN}--- 磁盘使用 ---${NC}"
            df -h /blog
            echo ""
            read -p "按 Enter 继续..."
            ;;
        8)
            view_error_logs
            echo ""
            read -p "按 Enter 继续..."
            ;;
        0)
            echo "退出"
            exit 0
            ;;
        *)
            echo -e "${RED}无效选项，请重试${NC}"
            sleep 1
            ;;
    esac
done
