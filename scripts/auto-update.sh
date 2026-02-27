#!/bin/bash
# 自动更新脚本 - 定时拉取代码和内容并部署
# 用途: 配合 crontab 实现自动更新部署

set -e

# ==================== 配置区域 ====================
# 项目目录
DEPLOY_BASE_DIR="/opt/blog"
PROJECT_DIR="${DEPLOY_BASE_DIR}/SiaBao-Blog"
CONTENT_DIR="${DEPLOY_BASE_DIR}/sia-blog-content"

# 部署脚本路径
DEPLOY_SCRIPT="${PROJECT_DIR}/scripts/cloud-deploy.sh"

# 健康检查脚本路径
HEALTH_SCRIPT="${PROJECT_DIR}/scripts/health-check.sh"

# 通知配置（可选）
NOTIFICATION_ENABLED=false
NOTIFICATION_WEBHOOK=""  # 例如: Discord webhook、钉钉机器人等

# 日志配置
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/auto_update_$(date +%Y%m%d_%H%M%S).log"
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

# ==================== 通知函数 ====================
send_notification() {
    local status=$1
    local message=$2

    if [ "$NOTIFICATION_ENABLED" = false ] || [ -z "$NOTIFICATION_WEBHOOK" ]; then
        return 0
    fi

    # 发送 webhook 通知（可根据实际服务调整）
    local payload="{
        \"status\": \"${status}\",
        \"message\": \"${message}\",
        \"timestamp\": \"$(date -Iseconds)\",
        \"server\": \"$(hostname)\"
    }"

    curl -X POST "$NOTIFICATION_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        --silent --show-error \
        > /dev/null 2>&1 || true
}

# ==================== 检查函数 ====================
check_environment() {
    log_info "检查环境..."

    # 检查项目目录
    if [ ! -d "${PROJECT_DIR}" ]; then
        log_error "项目目录不存在: ${PROJECT_DIR}"
        send_notification "error" "项目目录不存在"
        exit 1
    fi

    # 检查部署脚本
    if [ ! -f "${DEPLOY_SCRIPT}" ]; then
        log_error "部署脚本不存在: ${DEPLOY_SCRIPT}"
        send_notification "error" "部署脚本不存在"
        exit 1
    fi

    # 检查可执行权限
    if [ ! -x "${DEPLOY_SCRIPT}" ]; then
        log_warning "部署脚本无执行权限，正在添加..."
        chmod +x "${DEPLOY_SCRIPT}"
    fi

    log_success "环境检查完成"
}

check_for_updates() {
    log_info "检查代码和内容更新..."

    local has_updates=false

    # 检查公开仓库更新
    cd "${PROJECT_DIR}"
    git fetch origin > /dev/null 2>&1
    local local_ref=$(git rev-parse HEAD)
    local remote_ref=$(git rev-parse origin/main)

    if [ "$local_ref" != "$remote_ref" ]; then
        log_info "发现代码更新"
        has_updates=true
    fi

    # 检查私有仓库更新
    if [ -d "${CONTENT_DIR}" ]; then
        cd "${CONTENT_DIR}"
        git fetch origin > /dev/null 2>&1
        local local_ref=$(git rev-parse HEAD)
        local remote_ref=$(git rev-parse origin/main)

        if [ "$local_ref" != "$remote_ref" ]; then
            log_info "发现内容更新"
            has_updates=true
        fi
    fi

    if [ "$has_updates" = false ]; then
        log_info "代码和内容已是最新版本"
        return 1
    fi

    return 0
}

# ==================== 更新函数 ====================
run_deploy() {
    log_info "开始部署..."

    # 执行部署脚本（仅更新模式）
    if "${DEPLOY_SCRIPT}" -u >> "${LOG_FILE}" 2>&1; then
        log_success "部署脚本执行成功"
        return 0
    else
        log_error "部署脚本执行失败"
        send_notification "error" "自动更新部署失败"
        return 1
    fi
}

restart_services() {
    log_info "重启服务..."

    cd "${PROJECT_DIR}"

    if docker-compose -f docker-compose.prod.yml restart >> "${LOG_FILE}" 2>&1; then
        log_success "服务重启完成"
    else
        log_error "服务重启失败"
        send_notification "error" "服务重启失败"
        return 1
    fi
}

run_health_check() {
    log_info "执行健康检查..."

    if [ -f "${HEALTH_SCRIPT}" ]; then
        if "${HEALTH_SCRIPT}" -q >> "${LOG_FILE}" 2>&1; then
            log_success "健康检查通过"
            return 0
        else
            log_warning "健康检查发现问题"
            return 1
        fi
    else
        log_warning "健康检查脚本不存在，跳过"
        return 0
    fi
}

wait_for_services() {
    log_info "等待服务启动..."

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
            log_success "服务已就绪"
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 2
    done

    log_error "服务启动超时"
    send_notification "error" "服务启动超时"
    return 1
}

generate_summary() {
    log ""
    log "=========================================="
    log "  自动更新摘要"
    log "=========================================="
    log ""
    log "开始时间: $(date -d '@${START_TIME}' '+%Y-%m-%d %H:%M:%S')"
    log "结束时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log "耗时: $((($(date +%s) - START_TIME) / 60)) 分钟"
    log ""
    log "日志文件: ${LOG_FILE}"
    log ""

    # 检查最近的错误
    if grep -qi "error" "${LOG_FILE}"; then
        log_warning "日志中发现错误信息"
        log "最近的错误："
        grep -i "error" "${LOG_FILE}" | tail -5
        log ""
    fi
}

# ==================== 主流程 ====================
main() {
    START_TIME=$(date +%s)

    log "=========================================="
    log "  开始自动更新任务"
    log "=========================================="
    log ""

    # 检查环境
    check_environment

    # 检查是否有更新
    if ! check_for_updates; then
        log_info "无需更新，任务结束"
        send_notification "success" "自动更新检查完成，无需更新"
        exit 0
    fi

    # 执行部署
    if run_deploy; then
        # 重启服务
        if restart_services; then
            # 等待服务启动
            if wait_for_services; then
                # 健康检查
                if run_health_check; then
                    log_success "自动更新完成"
                    send_notification "success" "自动更新成功完成"
                else
                    log_warning "健康检查未通过，但服务已启动"
                fi
            else
                log_error "服务启动失败"
                send_notification "error" "服务启动失败"
                exit 1
            fi
        else
            log_error "重启服务失败"
            exit 1
        fi
    else
        log_error "部署失败"
        exit 1
    fi

    # 生成摘要
    generate_summary
}

# ==================== 脚本入口 ====================
print_usage() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示帮助信息"
    echo "  -f, --force         强制更新（不检查是否有更新）"
    echo "  -c, --check         仅检查更新，不执行部署"
    echo "  -s, --status        查看最近的更新状态"
    echo ""
    echo "Crontab 配置示例:"
    echo "  # 每天凌晨 2 点执行"
    echo "  0 2 * * * /opt/blog/sia-blog/scripts/auto-update.sh"
    echo ""
    echo "  # 每 6 小时执行一次"
    echo "  0 */6 * * * /opt/blog/sia-blog/scripts/auto-update.sh"
    echo ""
    echo "示例:"
    echo "  $0                  # 检查并执行更新"
    echo "  $0 -f               # 强制执行更新"
    echo "  $0 -c               # 仅检查更新"
    echo ""
}

show_status() {
    echo "=========================================="
    echo "  最近更新状态"
    echo "=========================================="
    echo ""

    # 显示最近 5 次更新日志
    echo "最近的更新日志："
    ls -lt "${LOG_DIR}"/auto_update_*.log 2>/dev/null | head -5 | awk '{print $9}' | while read log_file; do
        if [ -n "$log_file" ]; then
            echo ""
            echo "文件: $(basename "$log_file")"
            echo "时间: $(stat -c %y "$log_file" 2>/dev/null | cut -d'.' -f1)"
            echo "摘要："
            grep -E "(更新|部署|完成|失败)" "$log_file" | tail -3
        fi
    done

    echo ""
    echo "Git 更新状态："
    echo "--- 公开仓库（代码）---"
    cd "${PROJECT_DIR}" 2>/dev/null && git log -1 --oneline 2>/dev/null || echo "无法获取"

    echo ""
    echo "--- 私有仓库（内容）---"
    cd "${CONTENT_DIR}" 2>/dev/null && git log -1 --oneline 2>/dev/null || echo "无法获取"
}

# 解析命令行参数
case "${1:-}" in
    -h|--help)
        print_usage
        exit 0
        ;;
    -f|--force)
        log_info "强制更新模式"
        START_TIME=$(date +%s)
        log "=========================================="
        log "  强制更新任务"
        log "=========================================="
        log ""

        check_environment
        run_deploy && restart_services && wait_for_services
        generate_summary
        ;;
    -c|--check)
        log_info "仅检查更新"
        check_environment
        if check_for_updates; then
            log_info "发现可用更新"
            exit 0
        else
            log_info "无可用更新"
            exit 1
        fi
        ;;
    -s|--status)
        show_status
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
