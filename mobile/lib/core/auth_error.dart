import 'package:supabase_flutter/supabase_flutter.dart';

/// Maps a Supabase auth error to a short, user-facing Spanish message.
/// Never surfaces raw exception text (class names, stack traces, JSON
/// parse errors) to the UI.
String friendlyAuthError(Object error) {
  if (error is AuthApiException) {
    final msg = error.message.toLowerCase();
    if (msg.contains('invalid login credentials')) {
      return 'Correo o contraseña incorrectos.';
    }
    if (msg.contains('email not confirmed')) {
      return 'Confirma tu correo antes de iniciar sesión.';
    }
    if (msg.contains('user not found')) {
      return 'No encontramos una cuenta con ese correo.';
    }
    return 'No se pudo iniciar sesión. Intenta de nuevo.';
  }
  if (error is AuthRetryableFetchException || error is AuthUnknownException) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
  }
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}
