#!/bin/bash
# 快速部署脚本

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_DIR}"

echo "========================================="
echo "  My Blog 快速部署脚本"
echo "========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Docker
check_docker() {
    echo -n "检查 Docker..."
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}未安装${NC}"
        echo "请先安装 Docker: curl -fsSL https://get.docker.com | bash"
        exit 1
    fi
    echo -e "${GREEN}✓${NC}"
}

# 检查 Docker Compose
check_docker_compose() {
    echo -n "检查 Docker Compose..."
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}未安装${NC}"
        echo "请先安装 Docker Compose"
        exit 1
    fi
    echo -e "${GREEN}✓${NC}"
}

# 检查环境配置
check_env() {
    echo -n "检查环境配置..."
    if [ ! -f "server/.env" ]; then
        echo -e "${YELLOW}未配置${NC}"
        echo "正在复制示例配置..."
        cp server/.env.example server/.env
        echo -e "${YELLOW}请编辑 server/.env 文件，修改以下配置：${NC}"
        echo "  - SECRET_KEY (使用: openssl rand -hex 32)"
        echo "  - ADMIN_PASSWORD"
        echo "  - CORS_ORIGINS"
        echo ""
        read -p "按 Enter 继续（确保已修改配置）..."
    else
        echo -e "${GREEN}✓${NC}"
    fi
}

# 构建镜像
build_images() {
    echo ""
    echo "构建 Docker 镜像..."
    docker compose build
}

# 启动服务
start_services() {
    echo ""
    echo "启动服务..."
    docker compose up -d
}

# 等待服务就绪
wait_for_services() {
    echo ""
    echo "等待服务启动..."
    sleep 5

    # 检查健康状态
    if docker compose ps | grep -q "Up"; then
        echo -e "${GREEN}服务已启动${NC}"
        docker compose ps
    else
        echo -e "${RED}服务启动失败${NC}"
        docker compose logs
        exit 1
    fi
}

# 显示访问信息
show_info() {
    echo ""
    echo "========================================="
    echo -e "${GREEN}部署完成！${NC}"
    echo "========================================="
    echo ""
    echo "访问地址："
    echo "  前端: http://localhost"
    echo "  后端: http://localhost:8000"
    echo "  API文档: http://localhost:8000/docs"
    echo ""
    echo "常用命令："
    echo "  查看状态: docker compose ps"
    echo "  查看日志: docker compose logs -f"
    echo "  停止服务: docker compose down"
    echo "  重启服务: docker compose restart"
    echo ""
    echo "更多文档:"
    echo "  部署指南: DEPLOYMENT.md"
    echo "  运维指南: MAINTENANCE.md"
    echo ""
}

# 主流程
main() {
    check_docker
    check_docker_compose
    check_env
    build_images
    start_services
    wait_for_services
    show_info
}

main
