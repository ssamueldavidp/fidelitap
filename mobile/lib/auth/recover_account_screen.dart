import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase_client.dart';
import '../core/auth_error.dart';
import '../core/app_colors.dart';
import '../shared/auth_ui.dart';

import '../data/mobile_api_client.dart';

/// Recover a customer account (new phone / reinstall): prove ownership of the
/// email with a 6-digit code, then the backend re-links the customer's
/// existing cards to this session (POST /api/mobile/customer/claim).
class RecoverAccountScreen extends StatefulWidget {
  const RecoverAccountScreen({super.key});

  @override
  State<RecoverAccountScreen> createState() => _RecoverAccountScreenState();
}

class _RecoverAccountScreenState extends State<RecoverAccountScreen> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final email = _email.text.trim();
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      setState(() => _error = 'Ingresa un email válido');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      await supabase.auth.signInWithOtp(email: email, shouldCreateUser: true);
      setState(() { _codeSent = true; _busy = false; });
    } on Exception catch (e) {
      setState(() { _error = friendlyAuthError(e); _busy = false; });
    }
  }

  Future<void> _verify() async {
    setState(() { _busy = true; _error = null; });
    try {
      await supabase.auth.verifyOTP(
        email: _email.text.trim(),
        token: _code.text.trim(),
        type: OtpType.email,
      );
      final res = await MobileApiClient().post('/api/mobile/customer/claim', {});
      if (res.containsKey('error')) {
        await supabase.auth.signOut();
        setState(() { _error = res['error'] as String; _busy = false; _codeSent = false; });
        return;
      }
      if (mounted) Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
    } on Exception catch (e) {
      setState(() { _error = friendlyAuthError(e); _busy = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Recupera tu cuenta',
      subtitle: _codeSent
          ? 'Te enviamos un código de 6 dígitos a ${_email.text.trim()}. Ingrésalo para recuperar tus tarjetas.'
          : 'Ingresa el correo con el que te registraste. Te enviaremos un código para verificar que es tuyo.',
      children: [
          TextField(
            controller: _email,
            enabled: !_codeSent,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(hintText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
          ),
          if (_codeSent) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: const InputDecoration(hintText: 'Código de 6 dígitos', prefixIcon: Icon(Icons.pin_outlined)),
            ),
          ],
          if (_error != null) AuthError(_error!),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _busy ? null : (_codeSent ? _verify : _sendCode),
            child: _busy
                ? SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: context.colors.onBrand))
                : Text(_codeSent ? 'Verificar y recuperar' : 'Enviar código'),
          ),
          if (_codeSent)
            TextButton(
              onPressed: _busy ? null : () => setState(() { _codeSent = false; _code.clear(); _error = null; }),
              child: const Text('Cambiar correo'),
            ),
      ],
    );
  }
}
