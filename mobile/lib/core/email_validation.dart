// Mirrors src/lib/validations/disposable-email-domains.ts — instant client-side
// feedback only. The backend (customerProfileSchema/emailSchema) is the
// authoritative check either way, so this list doesn't need to stay
// byte-for-byte identical, just cover the same common cases.
const _disposableEmailDomains = {
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
};

bool isValidEmailFormat(String email) => RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email.trim());

bool isDisposableEmail(String email) {
  final domain = email.trim().split('@').lastOrNull?.toLowerCase();
  if (domain == null || domain.isEmpty) return false;
  return _disposableEmailDomains.contains(domain);
}

/// Returns a user-facing error, or null if the email passes both checks.
String? validateEmail(String email) {
  if (!isValidEmailFormat(email)) return 'Ingresa un email válido';
  if (isDisposableEmail(email)) return 'No se permiten correos temporales';
  return null;
}
