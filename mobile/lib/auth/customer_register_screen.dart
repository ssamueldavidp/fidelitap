import 'package:flutter/material.dart';
import '../core/email_validation.dart';
import 'email_verification.dart';
import '../core/app_colors.dart';
import '../shared/auth_ui.dart';

import '../data/mobile_api_client.dart';

/// Registers a customer with no card yet — same profile fields as
/// ActivateCardScreen, minus the card preview and the slug. Lands them back
/// on RoleGateScreen, which (via session_role.dart's customers.auth_user_id
/// check) now resolves them as a customer with an empty "Mis tarjetas",
/// leaving /auth/claim (the "+" button there) and Tiendas open to add a
/// card whenever they're ready.
class CustomerRegisterScreen extends StatefulWidget {
  const CustomerRegisterScreen({super.key});

  @override
  State<CustomerRegisterScreen> createState() => _CustomerRegisterScreenState();
}

class _CustomerRegisterScreenState extends State<CustomerRegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  bool _dataConsent = false;
  bool _marketingConsent = false;
  bool _submitting = false;
  String? _error;

  final _api = MobileApiClient();

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    if (_name.text.trim().length < 2) { setState(() => _error = 'Ingresa tu nombre'); return; }
    final emailError = validateEmail(_email.text);
    if (emailError != null) { setState(() => _error = emailError); return; }
    if (!_dataConsent) { setState(() => _error = 'Debes aceptar el tratamiento de datos para continuar.'); return; }

    setState(() { _submitting = true; _error = null; });
    try {
      if (!await ensureVerifiedEmail(context, _email.text)) {
        setState(() { _error = 'Debes verificar tu correo para continuar.'; _submitting = false; });
        return;
      }
      final res = await _api.post('/api/mobile/customer/register', {
        'name': _name.text.trim(),
        'email': _email.text.trim(),
        if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
        'data_consent': true,
        'marketing_consent': _marketingConsent,
      });
      if (res.containsKey('error')) {
        setState(() { _error = res['error'] as String; _submitting = false; });
        return;
      }
      if (mounted) Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
    } catch (e) {
      setState(() { _error = 'No se pudo completar el registro. Intenta de nuevo.'; _submitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return AuthScaffold(
      title: 'Crea tu cuenta',
      subtitle: 'Podrás agregar tu primera tarjeta de fidelización cuando quieras.',
      children: [
          TextField(
            controller: _name,
            decoration: const InputDecoration(hintText: 'Nombre completo', prefixIcon: Icon(Icons.person_outline)),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(hintText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(hintText: 'Celular (opcional)', prefixIcon: Icon(Icons.phone_outlined)),
          ),
          const SizedBox(height: 16),
          CheckboxListTile(
            value: _dataConsent,
            onChanged: (v) => setState(() => _dataConsent = v ?? false),
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'Acepto el tratamiento de mis datos personales conforme a la Ley 1581 de 2012.',
              style: TextStyle(fontSize: 12),
            ),
          ),
          CheckboxListTile(
            value: _marketingConsent,
            onChanged: (v) => setState(() => _marketingConsent = v ?? false),
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'Acepto recibir comunicaciones y promociones por email.',
              style: TextStyle(fontSize: 12),
            ),
          ),
          if (_error != null) AuthError(_error!),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _submitting ? null : _register,
            child: _submitting
                ? SizedBox(height: 20, width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: colors.onBrand))
                : const Text('Crear cuenta'),
          ),
      ],
    );
  }
}
