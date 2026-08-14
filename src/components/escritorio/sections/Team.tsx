import { site, type TeamMember } from '../../../content/escritorioSite'
import { IconUser } from '../ui/Icons'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'

function MemberCard({ member }: { member: TeamMember }) {
  return (
    <Reveal className="esc-member">
      <div>
        <div className="esc-member__photo">
          {member.photoSrc ? (
            <img src={member.photoSrc} alt={member.photoAlt ?? member.name} />
          ) : (
            <IconUser />
          )}
        </div>
        <p className="esc-member__oab">{member.oab}</p>
      </div>
      <div>
        <h3>{member.name}</h3>
        <p className="esc-member__role">{member.role}</p>
        <p className="esc-member__bio">{member.bio}</p>
        <dl className="esc-member__meta">
          <div>
            <dt>Formação</dt>
            <dd>
              {member.formation.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </dd>
          </div>
          <div>
            <dt>Associações</dt>
            <dd>
              {member.associations.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </dd>
          </div>
        </dl>
      </div>
    </Reveal>
  )
}

export function Team() {
  return (
    <section id="equipe" className="escritorio-section esc-team" aria-label={site.team.label}>
      <div className="escritorio-container">
        <SectionLabel>{site.team.label}</SectionLabel>
        <div className="esc-team__list">
          {site.team.members.map((member) => (
            <MemberCard key={member.name} member={member} />
          ))}
        </div>
      </div>
    </section>
  )
}
