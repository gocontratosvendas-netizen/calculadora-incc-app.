import { site } from '../../../content/escritorioSite'
import { IconLinkedIn, IconPhone } from '../ui/Icons'

export function TopBar() {
  const { topBar } = site

  return (
    <div className="esc-topbar">
      <div className="escritorio-container esc-topbar__inner">
        <p>{topBar.oab}</p>
        <div className="esc-topbar__right">
          <a className="esc-topbar__link" href={topBar.phoneHref}>
            <IconPhone />
            <span>{topBar.phone}</span>
          </a>
          <a
            className="esc-topbar__link"
            href={topBar.linkedInHref}
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
          >
            <IconLinkedIn />
          </a>
        </div>
      </div>
    </div>
  )
}
