import { site } from '../../../content/escritorioSite'
import { IconArrow } from '../ui/Icons'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'
import { SectionTitle } from '../ui/SectionTitle'

export function PracticeAreas() {
  const { practiceAreas } = site

  return (
    <section id="atuacao" className="escritorio-section esc-areas" aria-labelledby="areas-title">
      <div className="escritorio-container">
        <div className="esc-areas__head">
          <div>
            <SectionLabel>{practiceAreas.label}</SectionLabel>
            <SectionTitle id="areas-title">{practiceAreas.title}</SectionTitle>
          </div>
          <a className="esc-link-arrow" href={practiceAreas.seeAll.href}>
            {practiceAreas.seeAll.label}
            <IconArrow />
          </a>
        </div>

        <div>
          {practiceAreas.items.map((area) => (
            <Reveal key={area.number} className="esc-area" as="div">
              <span className="esc-area__num">{area.number}</span>
              <div>
                <h3>{area.title}</h3>
                <div className="esc-area__tags">
                  {area.tags.map((tag) => (
                    <span key={tag} className="esc-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <p className="esc-area__desc">{area.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
