import { useEffect, useState } from 'react'
import { site } from '../../../content/escritorioSite'
import { Button } from '../ui/Button'
import { Monogram } from '../ui/Monogram'

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <>
      <header className={scrolled ? 'esc-header is-scrolled' : 'esc-header'}>
        <div className="escritorio-container esc-header__inner">
          <a className="esc-brand" href="#topo" aria-label="Paludetto Advogados Associados">
            <Monogram />
            <span className="esc-wordmark">
              <span className="esc-wordmark__name">{site.brand.wordmark}</span>
              <span className="esc-wordmark__sig">{site.brand.signature}</span>
            </span>
          </a>

          <nav className="esc-nav" aria-label="Principal">
            {site.nav.map((item) => (
              <a key={item.href} className="esc-nav__link" href={item.href}>
                {item.label}
              </a>
            ))}
            <Button href={site.contactCta.href} variant="nav">
              {site.contactCta.label}
            </Button>
          </nav>

          <button
            type="button"
            className="esc-menu-toggle"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span />
          </button>
        </div>
      </header>

      <div
        className={menuOpen ? 'esc-mobile-nav is-open' : 'esc-mobile-nav'}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="esc-mobile-nav__top">
          <a className="esc-brand" href="#topo" onClick={closeMenu}>
            <Monogram size="sm" />
            <span className="esc-wordmark">
              <span className="esc-wordmark__name esc-wordmark__name--sm">
                {site.brand.wordmark}
              </span>
              <span className="esc-wordmark__sig">{site.brand.signature}</span>
            </span>
          </a>
          <button type="button" className="esc-mobile-nav__close" onClick={closeMenu}>
            Fechar
          </button>
        </div>
        <ul className="esc-mobile-nav__list">
          {site.nav.map((item) => (
            <li key={item.href}>
              <a href={item.href} onClick={closeMenu}>
                {item.label}
              </a>
            </li>
          ))}
          <li>
            <a href={site.contactCta.href} onClick={closeMenu}>
              {site.contactCta.label}
            </a>
          </li>
        </ul>
      </div>
    </>
  )
}
