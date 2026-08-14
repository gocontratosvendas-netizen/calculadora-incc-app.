type IconProps = {
  className?: string
}

export function IconPhone({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.5 3.5h3l1.2 4.2-1.8 1.2a12.5 12.5 0 0 0 5.2 5.2l1.2-1.8 4.2 1.2v3c0 .8-.6 1.5-1.4 1.5C10.6 18 6 13.4 6 7.9c0-.8.7-1.4 1.5-1.4Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconLinkedIn({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 10.5V16M8 7.8v.2M12 16v-3.4c0-1.2.8-2.1 2-2.1s2 .9 2 2.1V16"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconDocumentSearch({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3.5h7l3.5 3.5V20a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V4A.5.5 0 0 1 7 3.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M14 3.5V7h3.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11" cy="13" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="m13 15 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconUserCheck({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4.5 18.5c.8-2.6 2.9-4 5.5-4s4.7 1.4 5.5 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="m15.5 11.5 1.5 1.5 3-3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconChat({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 6.5h14a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9l-4 3v-3H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconArrow({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h13M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconPin({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

export function IconMail({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

export function IconUser({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M5 19c1.2-3.2 3.7-5 7-5s5.8 1.8 7 5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
