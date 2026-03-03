import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Tag, FolderOpen, ChevronDown, X } from 'lucide-react'
import './Sidebar.css'

export default function Sidebar({
  categories = [],
  tags = [],
  onCategoryClick,
  onTagClick,
  selectedCategory,
  selectedTag,
  filterMode = false,
  hasActiveFilters = false,
  hasPendingFilterChanges = false,
  onApplyFilters,
  onClearFilters,
  onMobileClose,
}) {
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(true)
  const [isTagsExpanded, setIsTagsExpanded] = useState(true)

  return (
    <aside className='sidebar'>
      <div className='sidebar-mobile-toolbar'>
        <h2 className='sidebar-mobile-title'>筛选</h2>
        <button
          className='sidebar-mobile-close'
          onClick={onMobileClose}
          aria-label='关闭筛选面板'
          type='button'
        >
          <X size={16} />
          <span>完成</span>
        </button>
      </div>

      {categories.length > 0 && (
        <div className='sidebar-section'>
          <button
            className='sidebar-title-btn'
            onClick={() => setIsCategoriesExpanded((prev) => !prev)}
            aria-expanded={isCategoriesExpanded}
            type='button'
          >
            <h3 className='sidebar-title'>
              <FolderOpen size={18} />
              分类
            </h3>
            <ChevronDown
              size={16}
              className={`sidebar-chevron ${isCategoriesExpanded ? 'sidebar-chevron-open' : ''}`}
            />
          </button>
          <div
            className={`sidebar-collapsible ${
              isCategoriesExpanded ? 'sidebar-collapsible-open' : ''
            }`}
            aria-hidden={!isCategoriesExpanded}
          >
            <ul className='sidebar-list'>
              {categories.map((category) => {
                const isSelected = selectedCategory === category.slug
                const handleClick = (event) => {
                  if (filterMode && onCategoryClick) {
                    event.preventDefault()
                    onCategoryClick(isSelected ? null : category.slug)
                  }
                }

                return (
                  <li key={category.id}>
                    {filterMode ? (
                      <button
                        className={`sidebar-link sidebar-link-button ${
                          isSelected ? 'sidebar-link-active' : ''
                        }`}
                        onClick={handleClick}
                        aria-label={`筛选分类 ${category.name}`}
                        aria-pressed={isSelected}
                        type='button'
                      >
                        {category.name}
                        <span className='sidebar-count'>{category.count}</span>
                      </button>
                    ) : (
                      <Link to={`/category/${category.slug}`} className='sidebar-link'>
                        {category.name}
                        <span className='sidebar-count'>{category.count}</span>
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className='sidebar-section'>
          <button
            className='sidebar-title-btn'
            onClick={() => setIsTagsExpanded((prev) => !prev)}
            aria-expanded={isTagsExpanded}
            type='button'
          >
            <h3 className='sidebar-title'>
              <Tag size={18} />
              标签
            </h3>
            <ChevronDown
              size={16}
              className={`sidebar-chevron ${isTagsExpanded ? 'sidebar-chevron-open' : ''}`}
            />
          </button>
          <div
            className={`sidebar-collapsible ${
              isTagsExpanded ? 'sidebar-collapsible-open' : ''
            }`}
            aria-hidden={!isTagsExpanded}
          >
            <div className='sidebar-tags'>
              {tags.map((tag) => {
                const isSelected = selectedTag === tag.slug
                const handleClick = (event) => {
                  if (filterMode && onTagClick) {
                    event.preventDefault()
                    onTagClick(isSelected ? null : tag.slug)
                  }
                }

                return (
                  <span key={tag.id}>
                    {filterMode ? (
                      <button
                        className={`sidebar-tag sidebar-tag-button ${
                          isSelected ? 'sidebar-tag-active' : ''
                        }`}
                        onClick={handleClick}
                        aria-label={`筛选标签 ${tag.name}`}
                        aria-pressed={isSelected}
                        type='button'
                      >
                        #{tag.name}
                      </button>
                    ) : (
                      <Link to={`/tag/${tag.slug}`} className='sidebar-tag'>
                        #{tag.name}
                      </Link>
                    )}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {filterMode && (
        <div className='sidebar-mobile-action-bar'>
          <button
            type='button'
            className='sidebar-action secondary'
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
          >
            清空筛选
          </button>
          <button
            type='button'
            className='sidebar-action primary'
            onClick={onApplyFilters}
            disabled={!hasPendingFilterChanges}
          >
            应用筛选
          </button>
        </div>
      )}
    </aside>
  )
}
