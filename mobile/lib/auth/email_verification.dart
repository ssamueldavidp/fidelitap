import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase_client.dart';
import '../core/auth_error.dart';
import '../data/mobile_api_client.dart';

/// Makes sure the current session belongs to a verified [email] (Supabase
/// email OTP). Returns true when it does — immediately if the session is
/// already verified for that address, otherwise after the user enters the
/// 6-digit code we email them. The backend enforces the same rule
/// (hasVerifiedEmail), this just gets the user there.
Future<bool> ensureVerifiedEmail(BuildContext context, String email) async {
  final user = supabase.auth.currentUser;
  if (user != null &&
      user.emailConfirmedAt != null &&
      user.email?.toLowerCase() == email.toLowerCase().trim()) {
    return true;
  }
  final ok = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _EmailCodeDialog(email: email.trim()),
  );
  return ok == true;
}

class _EmailCodeDialog extends StatefulWidget {
  final String email;
  const _EmailCodeDialog({required this.email});

  @override
  State<_EmailCodeDialog> createState() => _EmailCodeDialogState();
}

class _EmailCodeDialogState extends State<_EmailCodeDialog> {
  final _code = TextEditingController();
  bool _busy = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _send();
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() { _busy = true; _error = null; });
    try {
      await supabase.auth.signInWithOtp(email: widget.email, shouldCreateUser: true);
      setState(() => _busy = false);
    } on Exception catch (e) {
      setState(() { _error = friendlyAuthError(e); _busy = false; });
    }
  }

  Future<void> _verify() async {
    setState(() { _busy = true; _error = null; });
    try {
      await supabase.auth.verifyOTP(email: widget.email, token: _code.text.trim(), type: OtpType.email);
      // The verified session is a different auth user than the old anonymous
      // one: re-link an existing account's cards to it (404 = new customer).
      await MobileApiClient().post('/api/mobile/customer/claim', {});
      if (mounted) Navigator.of(context).pop(true);
    } on Exception catch (e) {
      setState(() { _error = friendlyAuthError(e); _busy = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Verifica tu correo'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Te enviamos un código de 6 dígitos a ${widget.email}.', style: const TextStyle(fontSize: 13)),
          const SizedBox(height: 12),
          TextField(
            controller: _code,
            keyboardType: TextInputType.number,
            maxLength: 6,
            decoration: const InputDecoration(hintText: 'Código', prefixIcon: Icon(Icons.pin_outlined)),
          ),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
        ],
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.of(context).pop(false), child: const Text('Cancelar')),
        TextButton(onPressed: _busy ? null : _send, child: const Text('Reenviar')),
        ElevatedButton(
          onPressed: _busy ? null : _verify,
          child: _busy
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Verificar'),
        ),
      ],
    );
  }
}
