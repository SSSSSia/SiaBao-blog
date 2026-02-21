/**
 * 分页组件
 * 极简艺术风格
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  maxVisiblePages = 7,
}) {
  // 计算显示的页码范围
  const getPageNumbers = () => {
    const pages = [];
    const halfVisible = Math.floor(maxVisiblePages / 2);

    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, currentPage + halfVisible);

    // 调整开始页码以显示足够的页数
    if (endPage - startPage + 1 < maxVisiblePages) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      } else {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
    }

    // 添加第一页和省略号
    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) {
        pages.push('...');
      }
    }

    // 添加中间页码
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // 添加最后一页和省略号
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  // 处理页码点击
  const handlePageClick = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  // 处理上一页
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  // 处理下一页
  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination">
      <button
        className="pagination-button pagination-button-prev"
        onClick={handlePrevious}
        disabled={currentPage === 1}
        aria-label="上一页"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="pagination-pages">
        {pageNumbers.map((page, index) => (
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="pagination-ellipsis">
              ...
            </span>
          ) : (
            <button
              key={page}
              className={`pagination-page ${
                page === currentPage ? 'pagination-page-active' : ''
              }`}
              onClick={() => handlePageClick(page)}
              aria-label={`第 ${page} 页`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          )
        ))}
      </div>

      <button
        className="pagination-button pagination-button-next"
        onClick={handleNext}
        disabled={currentPage === totalPages}
        aria-label="下一页"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
