#!/bin/bash
# 云服务器部署脚本 - 支持双仓库架构
# 用途: 在云服务器上自动部署 Sia Blog

set -e

# ==================== 配置区域 ====================
# 项目部署目录
DEPLOY_BASE_DIR="/blog"
PROJECT_DIR="${DEPLOY_BASE_DIR}/SiaBao-blog"
CONTENT_DIR="${DEPLOY_BASE_DIR}/sia-blog-content"

# GitHub 仓库地址（请根据实际情况修改）
PUBLIC_REPO="git@github.com:SSSSSia/SiaBao-blog.git"
PRIVATE_REPO="git@github.com:SSSSSia/sia-blog-content.git"

# 日志文件
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/deploy_$(date +%Y%m%d_%H%M%S).log"

# 创建日志目录
mkdir -p "${LOG_DIR}"

# ==================== 日志函数 ====================
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

# 新增：命令执行日志（显示输出）
log_exec() {
    local cmd="$1"
    log "执行命令: $cmd"
    if eval "$cmd" >> "${LOG_FILE}" 2>&1; then
        log_success "命令执行成功"
        return 0
    else
        local exit_code=$?
        log_error "命令执行失败 (退出码: $exit_code)"
        log "最近 20 行日志:"
        tail -20 "${LOG_FILE}" | sed 's/^/  /'
        return $exit_code
    fi
}

log_info() {
    echo -e "\033[0;34m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m [INFO] $1" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "\033[0;32m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m [SUCCESS] $1" | tee -a "${LOG_FILE}"
}

log_warning() {
    echo -e "\033[1;33m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m [WARNING] $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "\033[0;31m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m [ERROR] $1" | tee -a "${LOG_FILE}"
}

# ==================== 检查函数 ====================
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_warning "建议使用 root 用户运行此脚本"
        read -p "是否继续？(y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

check_docker() {
    log_info "检查 Docker 环境..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装"
        log_info "正在安装 Docker..."
        curl -fsSL https://get.docker.com | bash
        systemctl start docker
        systemctl enable docker
        log_success "Docker 安装完成"
    else
        log_success "Docker 已安装: $(docker --version)"
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装"
        log_info "正在安装 Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        log_success "Docker Compose 安装完成"
    else
        log_success "Docker Compose 已安装"
    fi
}

check_git_ssh() {
    log_info "检查 Git SSH 访问..."
    if ! ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
        log_error "GitHub SSH 访问未配置"
        log_info "请确保已将 SSH 公钥添加到 GitHub"
        exit 1
    fi
    log_success "GitHub SSH 访问正常"
}

# ==================== 仓库管理 ====================
clone_repositories() {
    log_info "创建项目目录..."
    mkdir -p "${DEPLOY_BASE_DIR}"

    # 克隆公开仓库
    if [ ! -d "${PROJECT_DIR}" ]; then
        log_info "克隆公开仓库（代码）..."
        git clone "${PUBLIC_REPO}" "${PROJECT_DIR}"
        log_success "公开仓库克隆完成"
    else
        log_info "公开仓库已存在，拉取最新代码..."
        cd "${PROJECT_DIR}"
        git fetch origin
        git pull origin main
        log_success "公开仓库更新完成"
    fi

    # 克隆私有仓库
    if [ ! -d "${CONTENT_DIR}" ]; then
        log_info "克隆私有仓库（内容）..."
        git clone "${PRIVATE_REPO}" "${CONTENT_DIR}"
        log_success "私有仓库克隆完成"
    else
        log_info "私有仓库已存在，拉取最新内容..."
        cd "${CONTENT_DIR}"
        git fetch origin
        git pull origin main
        log_success "私有仓库更新完成"
    fi
}

update_repositories() {
    log_info "更新仓库..."

    # 更新公开仓库
    log_info "拉取公开仓库（代码）..."
    cd "${PROJECT_DIR}"
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    if [ "$LOCAL" != "$REMOTE" ]; then
        git pull origin main
        log_success "代码已更新"
    else
        log_info "代码已是最新版本"
    fi

    # 更新私有仓库
    log_info "拉取私有仓库（内容）..."
    cd "${CONTENT_DIR}"
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    if [ "$LOCAL" != "$REMOTE" ]; then
        git pull origin main
        log_success "内容已更新"
    else
        log_info "内容已是最新版本"
    fi
}

# ==================== 配置管理 ====================
setup_environment() {
    log_info "配置环境变量..."

    # 复制环境配置
    if [ -f "${CONTENT_DIR}/server/.env" ]; then
        cp "${CONTENT_DIR}/server/.env" "${PROJECT_DIR}/server/.env"
        log_success "环境配置已复制"
    else
        log_warning "私有仓库中未找到 .env 文件"
        if [ -f "${PROJECT_DIR}/server/.env.example" ]; then
            cp "${PROJECT_DIR}/server/.env.example" "${PROJECT_DIR}/server/.env"
            log_warning "已从示例文件创建 .env，请手动配置"
            return 1
        fi
    fi
}

setup_data_link() {
    log_info "配置数据目录..."

    # 使用 docker-compose.prod.yml 的 Docker Volume 方案（推荐用于服务器）
    if grep -q "/blog/sia-blog-content/server/data:/app/server/data" "${PROJECT_DIR}/docker-compose.prod.yml" 2>/dev/null; then
        log_success "使用生产配置的 Docker Volume 挂载方案"
        return 0
    fi

    # 使用符号链接方案（备选）
    if [ ! -L "${PROJECT_DIR}/server/data" ] && [ -d "${CONTENT_DIR}/server/data" ]; then
        # 备份现有数据
        if [ -d "${PROJECT_DIR}/server/data" ]; then
            BACKUP_DIR="${PROJECT_DIR}/server/data.backup.$(date +%Y%m%d_%H%M%S)"
            log_warning "备份现有数据目录到 ${BACKUP_DIR}"
            mv "${PROJECT_DIR}/server/data" "${BACKUP_DIR}"
        fi

        # 创建符号链接
        cd "${PROJECT_DIR}/server"
        ln -s ../../sia-blog-content/server/data data
        log_success "数据目录符号链接已创建"
    fi
}

# ==================== 服务管理 ====================
stop_services() {
    log_info "停止现有服务..."
    cd "${PROJECT_DIR}"

    if docker-compose -f docker-compose.prod.yml ps -q | grep -q .; then
        docker-compose -f docker-compose.prod.yml down
        log_success "服务已停止"
    else
        log_info "没有运行中的服务"
    fi
}

start_services() {
    log_info "构建并启动服务..."
    cd "${PROJECT_DIR}"

    docker-compose -f docker-compose.prod.yml up -d --build
    log_success "服务启动完成"
}

wait_for_services() {
    log_info "等待服务启动..."
    sleep 10

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
            log_success "后端服务健康检查通过"
            return 0
        fi

        attempt=$((attempt + 1))
        log_info "等待服务启动... ($attempt/$max_attempts)"
        sleep 2
    done

    log_error "服务启动超时"
    return 1
}

check_services() {
    log_info "检查服务状态..."
    cd "${PROJECT_DIR}"

    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_success "服务运行正常"
        docker-compose -f docker-compose.prod.yml ps
    else
        log_error "服务状态异常"
        docker-compose -f docker-compose.prod.yml ps
        docker-compose -f docker-compose.prod.yml logs --tail=50
        return 1
    fi
}

# ==================== 部署流程 ====================
deploy() {
    log "=========================================="
    log "  Sia Blog 云服务器部署开始"
    log "=========================================="
    log ""

    # 首次部署检查
    local FIRST_DEPLOY=false
    if [ ! -d "${PROJECT_DIR}" ] || [ ! -d "${CONTENT_DIR}" ]; then
        FIRST_DEPLOY=true
        log_info "首次部署模式"

        check_root
        check_docker
        check_git_ssh
        clone_repositories
        setup_environment
        setup_data_link
    else
        log_info "更新部署模式"
        update_repositories
        setup_environment
    fi

    # 部署服务
    stop_services
    start_services
    wait_for_services
    check_services

    log ""
    log "=========================================="
    log_success "部署完成！"
    log "=========================================="
    log ""
    log "服务信息："
    log "  项目目录: ${PROJECT_DIR}"
    log "  内容目录: ${CONTENT_DIR}"
    log "  日志文件: ${LOG_FILE}"
    log ""
    log "访问地址："
    log "  前端: http://localhost"
    log "  后端: http://localhost:5000"
    log "  管理: http://localhost:5000/admin"
    log ""
    log "常用命令："
    log "  查看状态: docker compose ps"
    log "  查看日志: docker compose logs -f"
    log "  重启服务: docker compose restart"
    log ""
}

# ==================== 脚本入口 ====================
print_usage() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示帮助信息"
    echo "  -u, --update        仅更新代码和内容，不重新部署"
    echo "  -r, --restart       仅重启服务"
    echo "  -s, --status        查看服务状态"
    echo "  -l, --logs          查看服务日志"
    echo ""
    echo "示例:"
    echo "  $0                  # 完整部署"
    echo "  $0 -u               # 仅更新"
    echo "  $0 -r               # 仅重启"
    echo ""
}

update_only() {
    log_info "仅更新模式..."
    update_repositories
    setup_environment
    log_success "更新完成"
}

restart_only() {
    log_info "重启服务..."
    cd "${PROJECT_DIR}"
    docker-compose -f docker-compose.prod.yml restart
    log_success "服务已重启"
}

show_status() {
    cd "${PROJECT_DIR}"
    docker-compose -f docker-compose.prod.yml ps
}

show_logs() {
    cd "${PROJECT_DIR}"
    docker-compose -f docker-compose.prod.yml logs -f --tail=100
}

# 解析命令行参数
case "${1:-}" in
    -h|--help)
        print_usage
        exit 0
        ;;
    -u|--update)
        update_only
        ;;
    -r|--restart)
        restart_only
        ;;
    -s|--status)
        show_status
        ;;
    -l|--logs)
        show_logs
        ;;
    "")
        deploy
        ;;
    *)
        echo "未知选项: $1"
        print_usage
        exit 1
        ;;
esac
