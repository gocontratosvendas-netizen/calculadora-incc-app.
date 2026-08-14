import { site } from '../../../content/escritorioSite'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'
import { SectionTitle } from '../ui/SectionTitle'

export function Method() {
  const { method } = site

  return (
    <section id="metodo" className="escritorio-section esc-method" aria-labelledby="method-title">
      <div className="escritorio-container">
        <Reveal>
          <SectionLabel onDark>{method.label}</SectionLabel>
          <SectionTitle id="method-title" onDark>
            {method.title}
          </SectionTitle>
        </Reveal>
        <div className="esc-method__grid">
          {method.steps.map((step) => (
            <Reveal key={step.label} className="esc-step">
              <p className="esc-step__label">{step.label}</p>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
