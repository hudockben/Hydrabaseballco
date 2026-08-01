// The reach-out step: a first-touch email draft for a school on the list.
// The tiering picks who to contact; this writes the note so all that's left is
// hitting send.

import { statusOf, type CustomerRecord } from './customers';

const SENDER = {
  name: 'Ben Hudock',
  company: 'Hydra Baseball Co.',
  email: 'info@hydrabaseballco.com',
  site: 'hydrabaseballco.com',
};

export interface Draft {
  subject: string;
  body: string;
  /** `mailto:` URL — empty when there's no email address on file. */
  mailto: string;
}

/** "Mike Deegan" -> "Coach Deegan"; falls back to a plain greeting. */
function greeting(coachName: string | null): string {
  const name = (coachName ?? '').trim().replace(/,.*$/, '');
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `Coach ${parts[parts.length - 1]}`;
  if (parts.length === 1) return `Coach ${parts[0]}`;
  return 'Coach';
}

/** A short, honest first-touch note — warmed up when we know somebody there. */
export function outreachDraft(row: CustomerRecord): Draft {
  const school = (row.school ?? 'your program').trim();
  const conn = (row.firstDegreeConn ?? '').trim();
  const followUp = statusOf(row) !== 'new';

  const subject = followUp
    ? `Following up — Hydra Baseball Co. x ${school}`
    : `Game balls for ${school} baseball — Hydra Baseball Co.`;

  const opener = conn
    ? `${conn} pointed me toward your program, so I wanted to reach out directly.`
    : `I wanted to reach out directly about your ball order for the season.`;

  const lines = [
    `Hi ${greeting(row.coachName)},`,
    '',
    `I'm ${SENDER.name} with ${SENDER.company} — we make game and practice baseballs, built by players for players. ${opener}`,
    '',
    followUp
      ? `Circling back in case my last note got buried. Happy to send pricing for the quantities you go through in a season, or drop a sample dozen in the mail so your staff can put them through a practice.`
      : `We work with college programs on per-dozen pricing that holds up against what you're paying now, and I'd be glad to send a sample dozen so your staff can put them through a practice before you commit to anything.`,
    '',
    `Would it help if I sent over pricing this week?`,
    '',
    'Thanks for your time,',
    SENDER.name,
    `${SENDER.company} · ${SENDER.email} · ${SENDER.site}`,
  ];
  const body = lines.join('\n');

  const email = (row.email ?? '').trim().replace(/\s+/g, '');
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : '';

  return { subject, body, mailto };
}
