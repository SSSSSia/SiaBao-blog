#!/bin/bash
# 快速部署脚本
# 支持本地开发和云服务器部署

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_DIR}"

# 检测部署环境
DETECT_ENV() {
    if [ -d "/blog" ] && [ "${PROJECT_DIR}" = "/blog/SiaBao-blog" ]; then
        echo "cloud"
    else
        echo "local"
    fi
}

DEPLOY_ENV=$(DETECT_ENV)

# 根据环境选择 compose 文件
COMPOSE_FILE="docker-compose.yml"
COMPOSE_CMD="docker compose"
if [ "${DEPLOY_ENV}" = "cloud" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    COMPOSE_CMD="docker-compose -f docker-compose.prod.yml"
fi

echo "========================================="
echo "  Sia Blog 快速部署脚本"
echo "  环境: ${DEPLOY_ENV}"
echo "========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# 检查 Docker
check_docker() {
    echo -n "检查 Docker..."
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}未安装${NC}"
        log_info "请先安装 Docker: curl -fsSL https://get.docker.com | bash"
        exit 1
    fi
    echo -e "${GREEN}✓${NC}"
}

# 检查 Docker Compose
check_docker_compose() {
    echo -n "检查 Docker Compose..."
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}未安装${NC}"
        log_info "请先安装 Docker Compose"
        exit 1
    fi
    echo -e "${GREEN}✓${NC}"
}

# 检查环境配置
check_env() {
    echo -n "检查环境配置..."
    if [ ! -f "server/.env" ]; then
        echo -e "${YELLOW}未配置${NC}"
        log_info "正在复制示例配置..."
        cp server/.env.example server/.env

        # 云服务器环境特殊处理
        if [ "${DEPLOY_ENV}" = "cloud" ]; then
            # 检查私有仓库是否有配置
            if [ -f "/opt/sia-blog-content/server/.env" ]; then
                cp /opt/sia-blog-content/server/.env server/.env
                log_success "从私有仓库复制环境配置"
            else
                log_warning "请编辑 server/.env 文件，修改以下配置："
            fi
        else
            log_warning "请编辑 server/.env 文件，修改以下配置："
        fi

        echo "  - SECRET_KEY (使用: openssl rand -hex 32)"
        echo "  - ADMIN_PASSWORD"
        echo "  - CORS_ORIGINS"
        echo ""
        read -p "按 Enter 继续（确保已修改配置）..."
    else
        echo -e "${GREEN}✓${NC}"
    fi
}

# 检查数据目录（云服务器环境）
check_data_directory() {
    if [ "${DEPLOY_ENV}" = "cloud" ]; then
        log_info "检查数据目录配置..."

        # 检查是否使用 Docker Volume 挂载
        if grep -q "/blog/sia-blog-content/server/data:/app/server/data" docker-compose.prod.yml 2>/dev/null; then
            log_success "使用生产配置 Docker Volume 挂载方案"
        elif [ -L "server/data" ]; then
            local target=$(readlink -f server/data)
            log_success "数据符号链接正常 -> ${target}"
        elif [ ! -d "server/data" ]; then
            log_warning "数据目录不存在，创建中..."
            mkdir -p server/data/posts
            mkdir -p server/data/uploads
        fi
    fi
}

# 构建镜像
build_images() {
    echo ""
    log_info "构建 Docker 镜像..."
    $COMPOSE_CMD build
}

# 启动服务
start_services() {
    echo ""
    log_info "启动服务..."
    $COMPOSE_CMD up -d
}

# 等待服务就绪
wait_for_services() {
    echo ""
    log_info "等待服务启动..."

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if $COMPOSE_CMD ps | grep -q "Up"; then
            echo -e "${GREEN}服务已启动${NC}"
            $COMPOSE_CMD ps
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 2
    done

    echo -e "${RED}服务启动失败${NC}"
    $COMPOSE_CMD logs --tail=50
    exit 1
}

# 健康检查
health_check() {
    echo ""
    log_info "执行健康检查..."

    # 根据环境检查不同的端口
    if [ "${DEPLOY_ENV}" = "cloud" ]; then
        # 云服务器环境：后端 5000
        if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
            log_success "后端服务正常"
        else
            log_warning "后端健康检查失败（可能服务仍在启动中）"
        fi

        # 通过 Nginx 检查
        if curl -sf http://localhost > /dev/null 2>&1; then
            log_success "前端服务正常（通过 Nginx）"
        else
            log_warning "前端健康检查失败（可能服务仍在启动中）"
        fi
    else
        # 本地开发环境：后端 9090，前端 5173
        if curl -sf http://localhost:9090/api/health > /dev/null 2>&1; then
            log_success "后端服务正常"
        else
            log_warning "后端健康检查失败（可能服务仍在启动中）"
        fi

        if curl -sf http://localhost:5173 > /dev/null 2>&1; then
            log_success "前端服务正常"
        else
            log_warning "前端健康检查失败（可能服务仍在启动中）"
        fi
    fi
}

# 显示访问信息
show_info() {
    echo ""
    echo "========================================="
    echo -e "${GREEN}部署完成！${NC}"
    echo "========================================="
    echo ""

    if [ "${DEPLOY_ENV}" = "cloud" ]; then
        echo "云服务器部署环境"
        echo ""
        echo "访问地址："
        echo "  前端: http://localhost (或配置的域名)"
        echo "  后端: http://localhost:5000"
        echo "  管理: http://localhost:5000/admin"
        echo ""
        echo "其他脚本："
        echo "  云部署: ./scripts/cloud-deploy.sh"
        echo "  备份: ./scripts/cloud-backup.sh"
        echo "  健康检查: ./scripts/health-check.sh"
    else
        echo "本地开发环境"
        echo ""
        echo "访问地址："
        echo "  前端: http://localhost:5173"
        echo "  后端: http://localhost:9090"
        echo "  管理: http://localhost:9090/admin"
        echo ""
        echo "开发命令："
        echo "  前端开发: cd react-ui && npm run dev"
        echo "  后端开发: cd server && python start.py"
    fi

    echo ""
    echo "常用命令："
    echo "  查看状态: $COMPOSE_CMD ps"
    echo "  查看日志: $COMPOSE_CMD logs -f"
    echo "  停止服务: $COMPOSE_CMD down"
    echo "  重启服务: $COMPOSE_CMD restart"
    echo ""
    echo "更多文档:"
    echo "  云部署指南: CLOUD_DEPLOYMENT_GUIDE.md"
    echo "  双仓库架构: DUAL_REPOSITORY_SETUP.md"
    echo ""
}

# 主流程
main() {
    check_docker
    check_docker_compose
    check_env
    check_data_directory
    build_images
    start_services
    wait_for_services
    health_check
    show_info
}

main
