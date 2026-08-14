import { site } from '../../../content/escritorioSite'
import { Monogram } from '../ui/Monogram'

export function Footer() {
  const { footer, brand } = site

  return (
    <footer className="esc-footer">
      <div className="escritorio-container">
        <div className="esc-footer__grid">
          <div>
            <a className="esc-brand" href="#topo" aria-label="Paludetto Advogados Associados">
              <Monogram size="sm" />
              <span className="esc-wordmark">
                <span className="esc-wordmark__name esc-wordmark__name--sm">{brand.wordmark}</span>
                <span className="esc-wordmark__sig">{brand.signature}</span>
              </span>
            </a>
          </div>

          <div>
            <p className="esc-footer__col-title">{footer.navTitle}</p>
            <ul className="esc-footer__links">
              {footer.nav.map((item) => (
                <li key={item.label}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="esc-footer__col-title">{footer.practiceTitle}</p>
            <ul className="esc-footer__links">
              {footer.practice.map((item) => (
                <li key={item.label}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="esc-footer__col-title">{footer.noticeTitle}</p>
            <p className="esc-footer__notice">{footer.notice}</p>
          </div>
        </div>

        <div className="esc-footer__bar">
          <p>{footer.copyright}</p>
          <div className="esc-footer__bar-links">
            <a href={footer.privacyHref}>{footer.privacy}</a>
            <a href={footer.lgpdHref}>{footer.lgpd}</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
