#!/bin/bash
# 服务健康检查脚本
# 用途: 检查博客系统各服务的健康状态

set -e

# ==================== 配置区域 ====================
# 自动检测项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/health_check_$(date +%Y%m%d_%H%M%S).log"
mkdir -p "${LOG_DIR}"

# 服务端点
BACKEND_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"
ADMIN_URL="http://localhost:5000/admin"
HEALTH_ENDPOINT="${BACKEND_URL}/api/health"

# 超时设置（秒)
CURL_TIMEOUT=10

# 健康检查结果
FAILED_CHECKS=0

# ==================== 日志函数 ====================
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log_info() {
    echo -e "\033[0;34m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m [INFO] $1" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "\033[0;32m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m [✓] $1" | tee -a "${LOG_FILE}"
}

log_warning() {
    echo -e "\033[1;33m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m [!] $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "\033[0;31m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m [✗] $1" | tee -a "${LOG_FILE}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
}

# ==================== 检查函数 ====================
check_docker() {
    log_info "检查 Docker 服务..."

    if systemctl is-active --quiet docker; then
        log_success "Docker 服务运行中"
    else
        log_error "Docker 服务未运行"
        return 1
    fi

    if command -v docker &> /dev/null; then
        log_success "Docker 命令可用: $(docker --version | head -1)"
    else
        log_error "Docker 命令不可用"
        return 1
    fi
}

check_containers() {
    log_info "检查容器状态..."

    cd "${PROJECT_DIR}"

    # 检查容器是否运行
    local containers=("backend" "frontend" "nginx")
    local all_running=true

    for container in "${containers[@]}"; do
        if docker-compose -f docker-compose.prod.yml ps -q "$container" | grep -q .; then
            if docker-compose -f docker-compose.prod.yml ps "$container" | grep -q "Up"; then
                log_success "容器 $container 运行中"
            else
                log_error "容器 $container 未运行"
                all_running=false
            fi
        else
            log_warning "容器 $container 不存在"
        fi
    done

    if [ "$all_running" = false ]; then
        return 1
    fi
}

check_backend_health() {
    log_info "检查后端健康状态..."

    if curl -sf "${HEALTH_ENDPOINT}" --max-time ${CURL_TIMEOUT} > /dev/null 2>&1; then
        local response=$(curl -s "${HEALTH_ENDPOINT}" --max-time ${CURL_TIMEOUT})

        # 尝试解析 JSON 响应
        if echo "$response" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
            log_success "后端服务健康"
        elif echo "$response" | grep -q "healthy\|ok\|success"; then
            log_success "后端服务健康"
        else
            log_warning "后端响应异常: $response"
        fi
    else
        log_error "后端服务无响应"
        return 1
    fi
}

check_backend_api() {
    log_info "检查后端 API..."

    # 测试 API 端点
    local endpoints=(
        "/api/health"
        "/api/articles"
        "/api/config"
    )

    for endpoint in "${endpoints[@]}"; do
        local url="${BACKEND_URL}${endpoint}"

        if curl -sfI "$url" --max-time ${CURL_TIMEOUT} > /dev/null 2>&1; then
            local status_code=$(curl -sI "$url" --max-time ${CURL_TIMEOUT} | grep HTTP | awk '{print $2}')
            if [ "$status_code" = "200" ] || [ "$status_code" = "204" ]; then
                log_success "API $endpoint 可用 (HTTP $status_code)"
            else
                log_warning "API $endpoint 返回 HTTP $status_code"
            fi
        else
            log_error "API $endpoint 不可用"
        fi
    done
}

check_frontend() {
    log_info "检查前端服务..."

    if curl -sfI "${FRONTEND_URL}" --max-time ${CURL_TIMEOUT} > /dev/null 2>&1; then
        local status_code=$(curl -sI "${FRONTEND_URL}" --max-time ${CURL_TIMEOUT} | grep HTTP | awk '{print $2}')
        if [ "$status_code" = "200" ] || [ "$status_code" = "304" ]; then
            log_success "前端服务正常 (HTTP $status_code)"
        else
            log_warning "前端返回 HTTP $status_code"
        fi
    else
        log_error "前端服务无响应"
        return 1
    fi
}

check_nginx() {
    log_info "检查 Nginx 服务..."

    if curl -sfI "http://localhost" --max-time ${CURL_TIMEOUT} > /dev/null 2>&1; then
        local status_code=$(curl -sI "http://localhost" --max-time ${CURL_TIMEOUT} | grep HTTP | awk '{print $2}')
        if [ "$status_code" = "200" ] || [ "$status_code" = "301" ] || [ "$status_code" = "302" ]; then
            log_success "Nginx 服务正常 (HTTP $status_code)"
        else
            log_warning "Nginx 返回 HTTP $status_code"
        fi
    else
        log_error "Nginx 服务无响应"
        return 1
    fi
}

check_database() {
    log_info "检查数据库连接..."

    cd "${PROJECT_DIR}"

    # 检查数据库文件是否存在
    if docker-compose -f docker-compose.prod.yml exec -T backend ls /app/server/data/*.db > /dev/null 2>&1; then
        log_success "数据库文件存在"

        # 检查数据库完整性（SQLite）
        if docker-compose -f docker-compose.prod.yml exec -T backend python -c "
import sqlite3
import sys
try:
    conn = sqlite3.connect('/app/server/data/blog.db')
    conn.execute('PRAGMA integrity_check')
    conn.close()
    sys.exit(0)
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
" > /dev/null 2>&1; then
            log_success "数据库完整性检查通过"
        else
            log_warning "数据库完整性检查失败"
        fi
    else
        log_warning "数据库文件不存在（可能使用其他数据库）"
    fi
}

check_disk_space() {
    log_info "检查磁盘空间..."

    local disk_usage=$(df -h "${PROJECT_DIR}" | tail -1 | awk '{print $5}' | sed 's/%//')

    if [ "$disk_usage" -lt 80 ]; then
        log_success "磁盘使用率: ${disk_usage}%"
    elif [ "$disk_usage" -lt 90 ]; then
        log_warning "磁盘使用率: ${disk_usage}% (接近上限)"
    else
        log_error "磁盘使用率: ${disk_usage}% (空间不足)"
        return 1
    fi
}

check_memory_usage() {
    log_info "检查内存使用..."

    local mem_total=$(free -m | awk '/Mem:/ {print $2}')
    local mem_used=$(free -m | awk '/Mem:/ {print $3}')
    local mem_percent=$((mem_used * 100 / mem_total))

    if [ "$mem_percent" -lt 80 ]; then
        log_success "内存使用率: ${mem_percent}%"
    elif [ "$mem_percent" -lt 90 ]; then
        log_warning "内存使用率: ${mem_percent}% (较高)"
    else
        log_error "内存使用率: ${mem_percent}% (接近上限)"
        return 1
    fi

    # 检查容器内存使用
    cd "${PROJECT_DIR}"
    docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" || true
}

check_container_logs() {
    log_info "检查容器日志中的错误..."

    cd "${PROJECT_DIR}"

    local containers=("backend" "frontend" "nginx")
    local has_errors=false

    for container in "${containers[@]}"; do
        local errors=$(docker-compose -f docker-compose.prod.yml logs "$container" --tail=50 2>&1 | grep -i "error\|exception\|failed" | tail -5)
        if [ -n "$errors" ]; then
            log_warning "容器 $container 发现错误:"
            echo "$errors" | tee -a "${LOG_FILE}"
            has_errors=true
        fi
    done

    if [ "$has_errors" = false ]; then
        log_success "容器日志中未发现严重错误"
    fi
}

check_data_directory() {
    log_info "检查数据目录..."

    # 检查云服务器环境的标准数据目录
    local data_dirs=(
        "${PROJECT_DIR}/server/data/posts"
        "${PROJECT_DIR}/server/data/uploads"
    )

    for dir in "${data_dirs[@]}"; do
        if [ -d "$dir" ]; then
            local file_count=$(find "$dir" -type f | wc -l)
            log_success "目录 $dir 存在 (包含 $file_count 个文件)"
        else
            log_warning "目录 $dir 不存在"
        fi
    done

    # 检查数据目录挂载状态
    if [ -d "${PROJECT_DIR}/server/data" ]; then
        log_success "数据目录存在: ${PROJECT_DIR}/server/data"
    else
        log_warning "数据目录不存在: ${PROJECT_DIR}/server/data"
    fi
}
}

check_ssl_certificate() {
    log_info "检查 SSL 证书..."

    local ssl_dir="${PROJECT_DIR}/docker/ssl"

    if [ -f "${ssl_dir}/fullchain.pem" ]; then
        local expiry_date=$(openssl x509 -enddate -noout -in "${ssl_dir}/fullchain.pem" | cut -d= -f2)
        local expiry_epoch=$(date -d "${expiry_date}" +%s)
        local current_epoch=$(date +%s)
        local days_until_expiry=$(( ($expiry_epoch - $current_epoch) / 86400 ))

        if [ $days_until_expiry -gt 30 ]; then
            log_success "SSL 证书有效（剩余 $days_until_expiry 天）"
        elif [ $days_until_expiry -gt 0 ]; then
            log_warning "SSL 证书即将到期（剩余 $days_until_expiry 天）"
        else
            log_error "SSL 证书已过期"
        fi
    else
        log_warning "SSL 证书文件不存在"
    fi
}

generate_report() {
    log ""
    log "=========================================="
    log "  健康检查报告"
    log "=========================================="
    log ""
    log "检查时间: $(date)"
    log "项目目录: ${PROJECT_DIR}"
    log "日志文件: ${LOG_FILE}"
    log ""

    if [ $FAILED_CHECKS -eq 0 ]; then
        log_success "所有检查通过，系统运行正常"
        return 0
    else
        log_error "发现 ${FAILED_CHECKS} 个问题，请查看日志"
        return 1
    fi
}

# ==================== 主流程 ====================
main() {
    log "=========================================="
    log "  开始健康检查"
    log "=========================================="
    log ""

    # 执行各项检查
    check_docker
    check_containers
    check_backend_health
    check_backend_api
    check_frontend
    check_nginx
    check_database
    check_disk_space
    check_memory_usage
    check_data_directory
    check_ssl_certificate
    check_container_logs

    # 生成报告
    generate_report
}

# ==================== 脚本入口 ====================
print_usage() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示帮助信息"
    echo "  -q, --quiet         静默模式（只显示错误）"
    echo "  -j, --json          输出 JSON 格式"
    echo ""
    echo "示例:"
    echo "  $0                  # 执行健康检查"
    echo "  $0 -q               # 静默模式"
    echo ""
}

# 解析命令行参数
QUIET_MODE=false
JSON_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            print_usage
            exit 0
            ;;
        -q|--quiet)
            QUIET_MODE=true
            shift
            ;;
        -j|--json)
            JSON_MODE=true
            shift
            ;;
        *)
            echo "未知选项: $1"
            print_usage
            exit 1
            ;;
    esac
done

if [ "$JSON_MODE" = true ]; then
    # JSON 输出模式（简化版）
    echo '{"status":"checking","timestamp":"'$(date -Iseconds)'"}'
    main
    exit $?
fi

if [ "$QUIET_MODE" = false ]; then
    main
else
    # 静默模式：只输出错误
    exec 2>&1 | grep -i "error\|failed" || true
    main > /dev/null
fi
