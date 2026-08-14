import { useEffect } from 'react'
import { Footer } from '../../components/escritorio/layout/Footer'
import { Header } from '../../components/escritorio/layout/Header'
import { TopBar } from '../../components/escritorio/layout/TopBar'
import { About } from '../../components/escritorio/sections/About'
import { Articles } from '../../components/escritorio/sections/Articles'
import { Contact } from '../../components/escritorio/sections/Contact'
import { Hero } from '../../components/escritorio/sections/Hero'
import { Method } from '../../components/escritorio/sections/Method'
import { Pillars } from '../../components/escritorio/sections/Pillars'
import { PracticeAreas } from '../../components/escritorio/sections/PracticeAreas'
import { Team } from '../../components/escritorio/sections/Team'
import { site } from '../../content/escritorioSite'
import './Escritorio.css'

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500&display=swap'

export default function Escritorio() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = site.meta.title

    const metaDescription = ensureMeta('description')
    const previousDescription = metaDescription.getAttribute('content')
    metaDescription.setAttribute('content', site.meta.description)

    const fontLink = ensureStylesheet(FONT_HREF)
    const preconnectGoogle = ensurePreconnect('https://fonts.googleapis.com')
    const preconnectGstatic = ensurePreconnect('https://fonts.gstatic.com', true)

    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')

    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevHtmlScroll = html.style.scrollBehavior
    const prevRootOverflow = root?.style.overflow ?? ''
    const prevRootHeight = root?.style.height ?? ''
    const prevRootDisplay = root?.style.display ?? ''

    html.lang = 'pt-BR'
    html.style.overflow = 'auto'
    html.style.scrollBehavior = 'smooth'
    body.style.overflow = 'auto'
    body.classList.add('escritorio-active')
    if (root) {
      root.style.overflow = 'auto'
      root.style.height = 'auto'
      root.style.display = 'block'
    }

    return () => {
      document.title = previousTitle
      if (previousDescription) metaDescription.setAttribute('content', previousDescription)
      else metaDescription.remove()

      fontLink.remove()
      preconnectGoogle.remove()
      preconnectGstatic.remove()

      html.style.overflow = prevHtmlOverflow
      html.style.scrollBehavior = prevHtmlScroll
      body.style.overflow = prevBodyOverflow
      body.classList.remove('escritorio-active')
      if (root) {
        root.style.overflow = prevRootOverflow
        root.style.height = prevRootHeight
        root.style.display = prevRootDisplay
      }
    }
  }, [])

  return (
    <div className="escritorio" id="topo">
      <a className="escritorio-skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <TopBar />
      <Header />
      <main id="conteudo">
        <Hero />
        <Pillars />
        <About />
        <PracticeAreas />
        <Method />
        <Team />
        <Articles />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}

function ensureMeta(name: string): HTMLMetaElement {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  return el
}

function ensureStylesheet(href: string): HTMLLinkElement {
  let el = document.querySelector(`link[data-escritorio-fonts="true"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = 'stylesheet'
    el.href = href
    el.setAttribute('data-escritorio-fonts', 'true')
    document.head.appendChild(el)
  }
  return el
}

function ensurePreconnect(href: string, crossOrigin = false): HTMLLinkElement {
  const key = `data-escritorio-preconnect="${href}"`
  let el = document.querySelector(`link[${key}]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = 'preconnect'
    el.href = href
    if (crossOrigin) el.crossOrigin = 'anonymous'
    el.setAttribute('data-escritorio-preconnect', href)
    document.head.appendChild(el)
  }
  return el
}
