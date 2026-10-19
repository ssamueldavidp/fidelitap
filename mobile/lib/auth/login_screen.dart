import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/supabase_client.dart';
import '../core/auth_error.dart';
import '../core/env.dart';
import '../core/app_colors.dart';
import '../shared/auth_ui.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _obscure = true;

  Future<void> _openForgotPassword() async {
    final uri = Uri.parse('${Env.apiBaseUrl}/forgot-password');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _openWebRegister() async {
    final uri = Uri.parse('${Env.apiBaseUrl}/register');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _login() async {
    setState(() { _loading = true; _error = null; });
    try {
      await supabase.auth.signInWithPassword(
        email: _email.text.trim(),
        password: _password.text,
      );
      if (mounted) Navigator.of(context).pushReplacementNamed('/');
    } on Exception catch (e) {
      setState(() => _error = friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AuthScaffold(
      title: 'Hola de nuevo',
      subtitle: 'Entra a tu negocio para dar sellos, ver tus clientes y enviar campañas.',
      children: [
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          decoration: const InputDecoration(
            hintText: 'Correo electrónico',
            prefixIcon: Icon(Icons.email_outlined),
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _password,
          obscureText: _obscure,
          autofillHints: const [AutofillHints.password],
          onSubmitted: (_) => _loading ? null : _login(),
          decoration: InputDecoration(
            hintText: 'Contraseña',
            prefixIcon: const Icon(Icons.lock_outline_rounded),
            suffixIcon: IconButton(
              tooltip: _obscure ? 'Mostrar contraseña' : 'Ocultar contraseña',
              icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined),
              onPressed: () => setState(() => _obscure = !_obscure),
            ),
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: _openForgotPassword,
            child: const Text('¿Olvidaste tu contraseña?'),
          ),
        ),
        if (_error != null) AuthError(_error!),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _loading ? null : _login,
          child: _loading
              ? SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: c.onBrand))
              : const Text('Entrar'),
        ),
        const SizedBox(height: 28),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(22), border: Border.all(color: c.border)),
          child: Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(shape: BoxShape.circle, color: c.coralSoft),
              child: Icon(Icons.storefront_outlined, color: c.coral),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('¿Aún no tienes negocio?', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 2),
                GestureDetector(
                  onTap: _openWebRegister,
                  child: Text('Regístrate en la página web', style: TextStyle(color: c.brand, fontWeight: FontWeight.w800, fontSize: 14)),
                ),
              ]),
            ),
            Icon(Icons.open_in_new_rounded, color: c.textMuted, size: 18),
          ]),
        ),
      ],
    );
  }
}
