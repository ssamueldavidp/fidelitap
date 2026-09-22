// Common disposable/temporary email domains, blocked at registration so a
// business or customer can't sign up with a throwaway address. Not
// exhaustive — new services appear constantly — but covers the domains
// that show up most often in practice.
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamail.info',
  'guerrillamail.biz',
  'guerrillamail.de',
  'yopmail.com',
  'yopmail.net',
  'yopmail.fr',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.net',
  'getnada.com',
  'sharklasers.com',
  'dispostable.com',
  'fakeinbox.com',
  'moakt.com',
  'mohmal.com',
  'maildrop.cc',
  'mintemail.com',
  'mailnesia.com',
  'mailcatch.com',
  'emailondeck.com',
  'discard.email',
  'discardmail.com',
  'spamgourmet.com',
  'spam4.me',
  'tempinbox.com',
  'tempmailo.com',
  'tempr.email',
  'burnermail.io',
  'inboxbear.com',
  'mailsac.com',
  'mailnull.com',
  'nowmymail.com',
  'anonaddy.me',
  '33mail.com',
  'jetable.org',
  'fake-mail.net',
  'emailfake.com',
  'crazymailing.com',
  'tempail.com',
  'harakirimail.com',
  'incognitomail.com',
  'mailtemp.info',
  'tempemail.co',
  'tempemail.net',
])

export function isDisposableEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim()
  if (!domain) return false
  return DISPOSABLE_EMAIL_DOMAINS.has(domain)
}
