import { site } from '../../../content/escritorioSite'
import { Button } from '../ui/Button'
import { GoldRule } from '../ui/GoldRule'

function ArchitectureArt() {
  return (
    <div className="esc-hero__art" aria-hidden="true">
      <svg viewBox="0 0 420 640" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">
        <g stroke="#B08D57" strokeWidth="0.8">
          <path d="M40 620 V180 L160 80 L280 180 V620" />
          <path d="M40 180 H280" />
          <path d="M160 80 V40" strokeWidth="0.6" />
          {[225, 270, 315, 360, 405, 450, 495, 540, 585].map((y) => (
            <path key={y} d={`M48 ${y} H272`} strokeWidth="0.6" />
          ))}
          <path d="M280 280 H390 V620 H280" />
          {[325, 370, 415, 460, 505, 550, 595].map((y) => (
            <path key={`b-${y}`} d={`M288 ${y} H382`} strokeWidth="0.6" />
          ))}
          <path d="M280 280 H390" strokeWidth="1" />
          <path d="M90 620 V540 H130 V620" strokeWidth="0.7" />
          <path d="M310 620 V560 H350 V620" strokeWidth="0.7" />
        </g>
      </svg>
    </div>
  )
}

export function Hero() {
  const { hero } = site

  return (
    <section className="esc-hero" aria-labelledby="hero-title">
      <ArchitectureArt />
      <div className="escritorio-container esc-hero__grid">
        <div>
          <div className="esc-hero__eyebrow">
            <GoldRule />
            <span>{hero.label}</span>
          </div>
          <h1 id="hero-title">{hero.title}</h1>
          <p className="esc-hero__body">{hero.body}</p>
          <div className="esc-hero__actions">
            <Button href={hero.primaryCta.href} variant="primary">
              {hero.primaryCta.label}
            </Button>
            <Button href={hero.secondaryCta.href} variant="secondary">
              {hero.secondaryCta.label}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
