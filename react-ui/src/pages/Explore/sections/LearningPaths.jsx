/**
 * 学习路线展区
 */

import { LEARNING_PATHS_DATA } from '../../../constants/exploreData'

export default function LearningPaths() {
  return (
    <div className="explore-paths-grid">
      {LEARNING_PATHS_DATA.map((path) => (
        <div key={path.id} className="explore-path-card">
          <h3 className="explore-path-title">{path.title}</h3>
          <p className="explore-path-desc">{path.description}</p>
          <div className="explore-timeline">
            {path.steps.map((step) => (
              <div key={step.label} className="explore-timeline-step">
                <span className="explore-timeline-dot" />
                <span className="explore-timeline-label">{step.label}</span>
                <span className="explore-timeline-content">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
