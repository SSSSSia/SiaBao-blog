/**
 * 分页组件
 * 支持首页、上一页、页码、下一页、末页
 * URL 同步更新
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './Pagination.css';

export default function Pagination({
  total = 0,
  pageSize = 10,
  current = 1,
  onChange,
  maxVisiblePages = 7,
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 计算总页数
  const totalPages = Math.ceil(total / pageSize) || 1;

  // 计算显示的页码范围
  const getPageNumbers = () => {
    const pages = [];
    const halfVisible = Math.floor(maxVisiblePages / 2);

    let startPage = Math.max(2, current - halfVisible);
    let endPage = Math.min(totalPages - 1, current + halfVisible);

    // 调整范围以显示足够的页数
    if (endPage - startPage + 1 < maxVisiblePages - 2) {
      if (startPage === 2) {
        endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 3);
      } else {
        startPage = Math.max(2, endPage - maxVisiblePages + 3);
      }
    }

    // 添加首页
    if (totalPages > 0) {
      pages.push(1);
    }

    // 添加第一个省略号
    if (startPage > 2) {
      pages.push('...');
    }

    // 添加中间页码
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // 添加第二个省略号
    if (endPage < totalPages - 1) {
      pages.push('...');
    }

    // 添加末页
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  // 处理页码变化
  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages || page === current) return;

    // 触发 onChange 回调
    onChange?.(page);

    // 更新 URL 参数
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page);
    navigate({ search: newParams.toString() }, { replace: true });
  };

  // 首页
  const handleFirstPage = () => {
    handlePageChange(1);
  };

  // 上一页
  const handlePrevious = () => {
    handlePageChange(current - 1);
  };

  // 下一页
  const handleNext = () => {
    handlePageChange(current + 1);
  };

  // 末页
  const handleLastPage = () => {
    handlePageChange(totalPages);
  };

  // 如果只有一页或没有数据，不显示分页
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination-common">
      {/* 首页按钮 */}
      <button
        className="pagination-common-button"
        onClick={handleFirstPage}
        disabled={current === 1}
        aria-label="首页"
        title="首页"
      >
        <ChevronsLeft size={16} />
      </button>

      {/* 上一页按钮 */}
      <button
        className="pagination-common-button"
        onClick={handlePrevious}
        disabled={current === 1}
        aria-label="上一页"
        title="上一页"
      >
        <ChevronLeft size={16} />
      </button>

      {/* 页码列表 */}
      <div className="pagination-common-pages">
        {pageNumbers.map((page, index) =>
          page === '...' ? (
            <span
              key={`ellipsis-${index}`}
              className="pagination-common-ellipsis"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              className={`pagination-common-page ${
                page === current ? 'pagination-common-page-active' : ''
              }`}
              onClick={() => handlePageChange(page)}
              aria-label={`第 ${page} 页`}
              aria-current={page === current ? 'page' : undefined}
            >
              {page}
            </button>
          )
        )}
      </div>

      {/* 下一页按钮 */}
      <button
        className="pagination-common-button"
        onClick={handleNext}
        disabled={current === totalPages}
        aria-label="下一页"
        title="下一页"
      >
        <ChevronRight size={16} />
      </button>

      {/* 末页按钮 */}
      <button
        className="pagination-common-button"
        onClick={handleLastPage}
        disabled={current === totalPages}
        aria-label="末页"
        title="末页"
      >
        <ChevronsRight size={16} />
      </button>

      {/* 页码信息 */}
      <div className="pagination-common-info">
        {current} / {totalPages}
      </div>
    </div>
  );
}
