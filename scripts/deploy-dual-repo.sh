#!/bin/bash
# 双仓库部署脚本
# 用于部署代码仓库和内容仓库分离的架构

set -e

# ==================== 配置区域 ====================
# 项目目录（公开仓库）
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 内容目录（私有仓库，根据实际情况修改）
CONTENT_DIR="${PROJECT_DIR}/content"
# 如果使用独立克隆方式，修改为：
# CONTENT_DIR="/opt/sia-blog-content"

# GITHUB 仓库地址
PUBLIC_REPO="git@github.com:SSSSSia/sia-blog.git"
PRIVATE_REPO="git@github.com:SSSSSia/sia-blog-content.git"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==================== 函数定义 ====================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_git() {
    if ! command -v git &> /dev/null; then
        log_error "Git 未安装"
        exit 1
    fi
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装"
        exit 1
    fi

    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi
}

init_submodule() {
    if [ -f "${PROJECT_DIR}/.gitmodules" ]; then
        log_info "初始化 Git Submodule..."
        cd "${PROJECT_DIR}"

        if [ ! -d "content" ]; then
            git submodule init
            git submodule update
            log_success "Submodule 初始化完成"
        else
            log_info "Submodule 已存在，更新中..."
            git submodule update --remote
            log_success "Submodule 更新完成"
        fi
    fi
}

clone_content_repo() {
    if [ ! -d "${CONTENT_DIR}" ]; then
        log_info "克隆内容仓库（私有）..."
        mkdir -p "$(dirname "$CONTENT_DIR")"
        git clone "${PRIVATE_REPO}" "${CONTENT_DIR}"
        log_success "内容仓库克隆完成"
    fi
}

setup_symlinks() {
    log_info "配置数据目录链接..."

    # 如果使用 submodule，创建符号链接
    if [ -d "${CONTENT_DIR}/server/data" ]; then
        # 删除旧的 data 目录（如果存在且不是符号链接）
        if [ -d "${PROJECT_DIR}/server/data" ] && [ ! -L "${PROJECT_DIR}/server/data" ]; then
            log_warning "备份现有 data 目录..."
            mv "${PROJECT_DIR}/server/data" "${PROJECT_DIR}/server/data.backup.$(date +%Y%m%d_%H%M%S)"
        fi

        # 创建符号链接（如果不存在）
        if [ ! -L "${PROJECT_DIR}/server/data" ]; then
            cd "${PROJECT_DIR}/server"

            # 检测操作系统
            if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
                # Windows (需要管理员权限)
                if [ -d "data" ]; then
                    rmdir /s /q data 2>/dev/null || rm -rf data
                fi
                mklink /D data "..\\..\\content\\server\\data" 2>/dev/null || {
                    log_error "创建符号链接失败（需要管理员权限）"
                    log_info "尝试使用 Docker Volume 方案..."
                    return 1
                }
            else
                # Linux/Mac
                ln -s ../../content/server/data data
            fi

            log_success "数据目录链接创建完成"
        fi
    fi

    # 复制环境配置
    if [ -f "${CONTENT_DIR}/server/.env" ] && [ ! -f "${PROJECT_DIR}/server/.env" ]; then
        log_info "复制环境配置..."
        cp "${CONTENT_DIR}/server/.env" "${PROJECT_DIR}/server/.env"
        log_success "环境配置已复制"
    fi
}

update_repositories() {
    log_info "更新代码仓库（公开）..."
    cd "${PROJECT_DIR}"
    git pull origin main
    log_success "代码仓库更新完成"

    if [ -d "${CONTENT_DIR}" ]; then
        log_info "更新内容仓库（私有）..."
        cd "${CONTENT_DIR}"
        git pull origin main
        log_success "内容仓库更新完成"
    fi
}

deploy_services() {
    log_info "构建并启动服务..."
    cd "${PROJECT_DIR}"
    docker compose up -d --build
    log_success "服务启动完成"
}

check_health() {
    log_info "检查服务健康状态..."

    # 等待服务启动
    sleep 5

    if docker compose ps | grep -q "Up"; then
        log_success "服务运行正常"
        docker compose ps
    else
        log_error "服务启动失败"
        docker compose logs
        exit 1
    fi
}

show_info() {
    echo ""
    echo "========================================="
    echo -e "${GREEN}部署完成！${NC}"
    echo "========================================="
    echo ""
    echo "项目目录: ${PROJECT_DIR}"
    echo "内容目录: ${CONTENT_DIR}"
    echo ""
    echo "常用命令："
    echo "  更新内容: git -C ${CONTENT_DIR} pull"
    echo "  更新代码: git -C ${PROJECT_DIR} pull"
    echo "  查看状态: docker compose ps"
    echo "  查看日志: docker compose logs -f"
    echo ""
}

# ==================== 主流程 ====================

main() {
    echo "========================================="
    echo "  Sia Blog 双仓库部署脚本"
    echo "========================================="
    echo ""

    # 检查环境
    check_git
    check_docker

    # 初始化 submodule（如果使用）
    init_submodule

    # 克隆内容仓库（如果不使用 submodule）
    if [ ! -d "${CONTENT_DIR}" ]; then
        read -p "是否克隆内容仓库？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            clone_content_repo
        else
            log_warning "跳过内容仓库克隆"
        fi
    fi

    # 配置符号链接（如果使用 submodule）
    if [ -d "${CONTENT_DIR}" ]; then
        setup_symlinks || {
            log_warning "符号链接创建失败，使用 Docker Volume 方案"
            log_info "请确保 docker-compose.yml 配置正确"
        }
    fi

    # 更新仓库
    update_repositories

    # 部署服务
    deploy_services

    # 健康检查
    check_health

    # 显示信息
    show_info
}

# 执行主流程
main "$@"
