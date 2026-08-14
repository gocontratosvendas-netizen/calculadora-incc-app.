import { site } from '../../../content/escritorioSite'
import { IconArrow } from '../ui/Icons'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'
import { SectionTitle } from '../ui/SectionTitle'

export function Articles() {
  const { articles } = site

  return (
    <section id="artigos" className="escritorio-section esc-articles" aria-labelledby="articles-title">
      <div className="escritorio-container">
        <div className="esc-articles__head">
          <div>
            <SectionLabel>{articles.label}</SectionLabel>
            <SectionTitle id="articles-title">{articles.title}</SectionTitle>
          </div>
          <a className="esc-link-arrow" href={articles.seeAll.href}>
            {articles.seeAll.label}
            <IconArrow />
          </a>
        </div>

        <div className="esc-articles__grid">
          {articles.items.map((article) => (
            <Reveal key={article.title} as="article" className="esc-article">
              <p className="esc-article__meta">{article.meta}</p>
              <h3>{article.title}</h3>
              <p>{article.summary}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
