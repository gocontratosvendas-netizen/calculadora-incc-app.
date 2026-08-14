import { site } from '../../../content/escritorioSite'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'
import { SectionTitle } from '../ui/SectionTitle'

export function About() {
  const { about } = site

  return (
    <section id="escritorio" className="escritorio-section esc-about" aria-labelledby="about-title">
      <div className="escritorio-container esc-about__grid">
        <Reveal className="esc-about__copy">
          <SectionLabel>{about.label}</SectionLabel>
          <SectionTitle id="about-title">{about.title}</SectionTitle>
          {about.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </Reveal>
        <Reveal className="esc-about__quote">
          <blockquote>“{about.quote}”</blockquote>
          <cite>{about.attribution}</cite>
        </Reveal>
      </div>
    </section>
  )
}
