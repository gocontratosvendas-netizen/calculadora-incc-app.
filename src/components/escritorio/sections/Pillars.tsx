import { site } from '../../../content/escritorioSite'
import { IconChat, IconDocumentSearch, IconUserCheck } from '../ui/Icons'
import { Reveal } from '../ui/Reveal'

const icons = {
  document: IconDocumentSearch,
  userCheck: IconUserCheck,
  chat: IconChat,
} as const

export function Pillars() {
  return (
    <section className="esc-pillars" aria-label="Pilares">
      <div className="escritorio-container esc-pillars__grid">
        {site.pillars.map((pillar) => {
          const Icon = icons[pillar.icon]
          return (
            <Reveal key={pillar.title} className="esc-pillar">
              <Icon />
              <div>
                <p className="esc-pillar__title">{pillar.title}</p>
                <p className="esc-pillar__desc">{pillar.description}</p>
              </div>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}
