/**
 * 开源精选展区
 */

import { ExternalLink } from 'lucide-react'
import { OPEN_SOURCE_DATA } from '../../../constants/exploreData'

export default function OpenSource() {
  return (
    <div className="explore-card-grid">
      {OPEN_SOURCE_DATA.map((project) => (
        <div key={project.name} className="explore-content-card">
          <h3 className="explore-card-title">{project.name}</h3>
          <p className="explore-card-desc">{project.desc}</p>
          <div className="explore-card-meta">
            <div className="explore-card-tags">
              {project.tags.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
            <span className="explore-card-date">★ {project.stars}</span>
          </div>
          {project.url && (
            <a href={project.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} />
              查看项目
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
