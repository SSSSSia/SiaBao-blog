#!/bin/bash
# SSL 证书自动续期脚本
# 用途: 自动续期 Let's Encrypt SSL 证书并重启 Nginx

set -e

# ==================== 配置区域 ====================
# 域名配置（请根据实际情况修改）
DOMAIN="your-domain.com"
DOMAIN_WWW="www.your-domain.com"

# 邮箱配置（用于证书过期提醒）
EMAIL="your-email@example.com"

# 项目目录
PROJECT_DIR="/opt/blog/SiaBao-Blog"
SSL_DIR="${PROJECT_DIR}/docker/ssl"

# 证书路径（Let's Encrypt 默认路径）
LETSENCRYPT_LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"

# 日志文件
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/ssl_renew_$(date +%Y%m%d_%H%M%S).log"
mkdir -p "${LOG_DIR}"

# ==================== 日志函数 ====================
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
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
check_certbot() {
    log_info "检查 Certbot..."
    if ! command -v certbot &> /dev/null; then
        log_error "Certbot 未安装"
        log_info "正在安装 Certbot..."

        # 检测操作系统并安装
        if [ -f /etc/debian_version ]; then
            apt update
            apt install -y certbot
        elif [ -f /etc/redhat-release ]; then
            yum install -y certbot
        else
            log_error "无法自动安装 Certbot，请手动安装"
            exit 1
        fi

        log_success "Certbot 安装完成"
    else
        log_success "Certbot 已安装: $(certbot --version | head -1)"
    fi
}

check_certificate() {
    log_info "检查证书状态..."

    if [ ! -f "${LETSENCRYPT_LIVE_DIR}/fullchain.pem" ]; then
        log_warning "证书不存在，需要首次获取证书"
        return 1
    fi

    # 检查证书有效期
    local expiry_date=$(openssl x509 -enddate -noout -in "${LETSENCRYPT_LIVE_DIR}/fullchain.pem" | cut -d= -f2)
    local expiry_epoch=$(date -d "${expiry_date}" +%s)
    local current_epoch=$(date +%s)
    local days_until_expiry=$(( ($expiry_epoch - $current_epoch) / 86400 ))

    log_info "证书到期时间: ${expiry_date}"
    log_info "剩余天数: ${days_until_expiry} 天"

    if [ $days_until_expiry -lt 30 ]; then
        log_warning "证书将在 30 天内到期，需要续期"
        return 1
    else
        log_success "证书状态良好"
        return 0
    fi
}

# ==================== 证书操作 ====================
obtain_certificate() {
    log_info "首次获取 SSL 证书..."

    # 停止 Nginx 以释放 80/443 端口
    log_info "停止 Nginx 服务..."
    cd "${PROJECT_DIR}"
    docker-compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true

    # 使用 standalone 模式获取证书
    certbot certonly --standalone \
        -d "${DOMAIN}" \
        -d "${DOMAIN_WWW}" \
        --email "${EMAIL}" \
        --agree-tos \
        --non-interactive \
        --keep-until-expiring

    log_success "证书获取完成"
}

renew_certificate() {
    log_info "续期 SSL 证书..."

    # 停止 Nginx 以释放 80/443 端口
    log_info "停止 Nginx 服务..."
    cd "${PROJECT_DIR}"
    docker-compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true

    # 续期证书
    certbot renew --quiet --no-self-upgrade

    log_success "证书续期完成"
}

copy_certificate() {
    log_info "复制证书到项目目录..."

    # 创建 SSL 目录
    mkdir -p "${SSL_DIR}"

    # 复制证书文件
    if [ -f "${LETSENCRYPT_LIVE_DIR}/fullchain.pem" ] && [ -f "${LETSENCRYPT_LIVE_DIR}/privkey.pem" ]; then
        cp "${LETSENCRYPT_LIVE_DIR}/fullchain.pem" "${SSL_DIR}/"
        cp "${LETSENCRYPT_LIVE_DIR}/privkey.pem" "${SSL_DIR}/"
        chmod 644 "${SSL_DIR}/fullchain.pem"
        chmod 600 "${SSL_DIR}/privkey.pem"

        # 可选：复制证书链
        if [ -f "${LETSENCRYPT_LIVE_DIR}/chain.pem" ]; then
            cp "${LETSENCRYPT_LIVE_DIR}/chain.pem" "${SSL_DIR}/"
            chmod 644 "${SSL_DIR}/chain.pem"
        fi

        log_success "证书复制完成"
    else
        log_error "证书文件不存在"
        return 1
    fi
}

restart_nginx() {
    log_info "重启 Nginx 服务..."

    cd "${PROJECT_DIR}"

    # 启动 Nginx
    docker-compose -f docker-compose.prod.yml start nginx

    # 等待 Nginx 启动
    sleep 3

    # 验证 Nginx 状态
    if docker-compose -f docker-compose.prod.yml ps nginx | grep -q "Up"; then
        log_success "Nginx 重启完成"
    else
        log_error "Nginx 启动失败"
        docker-compose -f docker-compose.prod.yml logs nginx --tail=50
        return 1
    fi
}

verify_certificate() {
    log_info "验证证书配置..."

    # 检查证书文件
    if [ ! -f "${SSL_DIR}/fullchain.pem" ] || [ ! -f "${SSL_DIR}/privkey.pem" ]; then
        log_error "证书文件不存在"
        return 1
    fi

    # 验证证书有效期
    local expiry_date=$(openssl x509 -enddate -noout -in "${SSL_DIR}/fullchain.pem" | cut -d= -f2)
    local expiry_epoch=$(date -d "${expiry_date}" +%s)
    local current_epoch=$(date +%s)
    local days_until_expiry=$(( ($expiry_epoch - $current_epoch) / 86400 ))

    log_success "证书到期时间: ${expiry_date}"
    log_success "剩余天数: ${days_until_expiry} 天"

    # 检查 HTTPS 连接
    if command -v curl &> /dev/null; then
        log_info "检查 HTTPS 连接..."
        if curl -sfI "https://${DOMAIN}" > /dev/null 2>&1; then
            log_success "HTTPS 连接正常"
        else
            log_warning "HTTPS 连接测试失败（可能需要等待 DNS 生效）"
        fi
    fi
}

setup_auto_renewal() {
    log_info "设置自动续期任务..."

    # 创建续期脚本链接到 crontab
    local cron_job="0 3 1 * * ${PROJECT_DIR}/scripts/renew-ssl.sh"

    if crontab -l 2>/dev/null | grep -q "renew-ssl.sh"; then
        log_warning "自动续期任务已存在"
    else
        # 添加到 crontab（每月 1 号凌晨 3 点执行）
        (crontab -l 2>/dev/null; echo "${cron_job}") | crontab -
        log_success "自动续期任务已添加（每月 1 号凌晨 3 点执行）"
    fi
}

# ==================== 主流程 ====================
main() {
    log "=========================================="
    log "  SSL 证书续期脚本"
    log "=========================================="
    log ""
    log "域名: ${DOMAIN}"
    log "项目目录: ${PROJECT_DIR}"
    log "日志文件: ${LOG_FILE}"
    log ""

    # 检查 Certbot
    check_certbot

    # 检查或获取证书
    if ! check_certificate; then
        # 证书不存在或即将到期
        if [ ! -f "${LETSENCRYPT_LIVE_DIR}/fullchain.pem" ]; then
            obtain_certificate
        else
            renew_certificate
        fi

        # 复制证书
        copy_certificate

        # 重启 Nginx
        restart_nginx

        # 验证证书
        verify_certificate
    else
        log_info "证书状态良好，无需续期"
    fi

    # 设置自动续期
    setup_auto_renewal

    log ""
    log "=========================================="
    log_success "SSL 证书处理完成"
    log "=========================================="
    log ""
}

# ==================== 脚本入口 ====================
print_usage() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示帮助信息"
    echo "  -f, --force         强制续期证书"
    echo "  -c, --check         仅检查证书状态"
    echo "  -s, --setup         仅设置自动续期任务"
    echo ""
    echo "示例:"
    echo "  $0                  # 检查并续期证书"
    echo "  $0 -f               # 强制续期"
    echo "  $0 -c               # 仅检查状态"
    echo ""
}

# 解析命令行参数
case "${1:-}" in
    -h|--help)
        print_usage
        exit 0
        ;;
    -f|--force)
        log_info "强制续期模式"
        check_certbot
        renew_certificate
        copy_certificate
        restart_nginx
        verify_certificate
        ;;
    -c|--check)
        log_info "仅检查证书状态"
        if check_certificate; then
            log_success "证书状态良好"
            exit 0
        else
            log_warning "证书需要续期"
            exit 1
        fi
        ;;
    -s|--setup)
        log_info "仅设置自动续期任务"
        setup_auto_renewal
        ;;
    "")
        main
        ;;
    *)
        echo "未知选项: $1"
        print_usage
        exit 1
        ;;
esac
