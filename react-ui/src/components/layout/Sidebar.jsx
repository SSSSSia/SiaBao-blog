import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Tag, FolderOpen, ChevronDown } from 'lucide-react'
import './Sidebar.css'

export default function Sidebar({
  categories = [],
  tags = [],
  onCategoryClick,
  onTagClick,
  selectedCategory,
  selectedTag,
  filterMode = false,
}) {
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(true)
  const [isTagsExpanded, setIsTagsExpanded] = useState(true)

  return (
    <aside className='sidebar'>
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
          {isCategoriesExpanded && (
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
                      >
                        {category.name}
                        <span className='sidebar-count'>{category.count}</span>
                      </button>
                    ) : (
                      <Link
                        to={`/category/${category.slug}`}
                        className='sidebar-link'
                      >
                        {category.name}
                        <span className='sidebar-count'>{category.count}</span>
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
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
          {isTagsExpanded && (
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
          )}
        </div>
      )}
    </aside>
  )
}
