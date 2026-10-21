import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../shared/ui.dart';
import '../core/email_validation.dart';
import 'email_verification.dart';
import '../data/mobile_api_client.dart';
import '../core/supabase_client.dart';

/// A brand-new customer registers a card entirely inside the app: they
/// scanned a business's activation QR (handled by ClaimCardScreen, which
/// detects a /c/[slug] link and routes here with the slug already
/// extracted), see the card preview, and enter their info — the same
/// fields the public web activation page collects.
class ActivateCardScreen extends StatefulWidget {
  final String slug;
  const ActivateCardScreen({super.key, required this.slug});

  @override
  State<ActivateCardScreen> createState() => _ActivateCardScreenState();
}

class _ActivateCardScreenState extends State<ActivateCardScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  bool _dataConsent = false;
  bool _marketingConsent = false;

  bool _loadingCard = true;
  bool _submitting = false;
  String? _loadError;
  String? _submitError;
  Map<String, dynamic>? _card;

  final _api = MobileApiClient();

  @override
  void initState() {
    super.initState();
    _prefill();
    _loadCard();
  }

  /// Si la persona ya tiene cuenta, rellena sus datos para no pedírselos de nuevo.
  Future<void> _prefill() async {
    try {
      final user = supabase.auth.currentUser;
      if (user == null) return;
      final row = await supabase
          .from('customers')
          .select('name, email, phone')
          .eq('auth_user_id', user.id)
          .maybeSingle();
      if (!mounted) return;
      if (row != null) {
        if (_name.text.isEmpty) _name.text = (row['name'] as String?) ?? '';
        if (_email.text.isEmpty) _email.text = (row['email'] as String?) ?? '';
        if (_phone.text.isEmpty) _phone.text = (row['phone'] as String?) ?? '';
      } else if (_email.text.isEmpty && (user.email ?? '').isNotEmpty) {
        _email.text = user.email!;
      }
      setState(() {});
    } catch (_) {
      // Sin datos previos: el formulario queda vacío.
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _loadCard() async {
    setState(() { _loadingCard = true; _loadError = null; });
    try {
      final res = await _api.get('/api/mobile/cards/by-slug/${widget.slug}') as Map<String, dynamic>;
      if (res.containsKey('error')) {
        setState(() { _loadError = res['error'] as String; _loadingCard = false; });
        return;
      }
      setState(() { _card = res; _loadingCard = false; });
    } catch (e) {
      setState(() { _loadError = 'No se pudo cargar la tarjeta. Verifica tu conexión.'; _loadingCard = false; });
    }
  }

  Future<void> _activate() async {
    if (_name.text.trim().length < 2) { setState(() => _submitError = 'Ingresa tu nombre'); return; }
    final emailError = validateEmail(_email.text);
    if (emailError != null) { setState(() => _submitError = emailError); return; }
    if (!_dataConsent) { setState(() => _submitError = 'Debes aceptar el tratamiento de datos para continuar.'); return; }

    setState(() { _submitting = true; _submitError = null; });
    try {
      if (!await ensureVerifiedEmail(context, _email.text)) {
        setState(() { _submitError = 'Debes verificar tu correo para continuar.'; _submitting = false; });
        return;
      }
      final res = await _api.post('/api/mobile/activate', {
        'slug': widget.slug,
        'name': _name.text.trim(),
        'email': _email.text.trim(),
        if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
        'data_consent': true,
        'marketing_consent': _marketingConsent,
      });
      if (res.containsKey('error')) {
        setState(() { _submitError = res['error'] as String; _submitting = false; });
        return;
      }
      if (mounted) Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
    } catch (e) {
      setState(() { _submitError = 'No se pudo activar la tarjeta. Intenta de nuevo.'; _submitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Activar tarjeta')),
      body: _loadingCard
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_loadError!, textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.redAccent)),
                        const SizedBox(height: 16),
                        OutlinedButton(onPressed: _loadCard, child: const Text('Reintentar')),
                      ],
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    _cardPreview(),
                    const SizedBox(height: 24),
                    const Text('Tus datos', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 16),
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
                        'Acepto recibir comunicaciones y promociones del negocio por email.',
                        style: TextStyle(fontSize: 12),
                      ),
                    ),
                    if (_submitError != null) ...[
                      const SizedBox(height: 8),
                      Text(_submitError!, style: const TextStyle(color: Colors.redAccent)),
                    ],
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _submitting ? null : _activate,
                      child: _submitting
                          ? const SizedBox(height: 20, width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Activar mi tarjeta'),
                    ),
                  ],
                ),
    );
  }

  Widget _cardPreview() {
    final c = _card!;
    return GradientHero(
      radius: 28,
      child: SizedBox(
        width: double.infinity,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text((c['business_name'] as String? ?? '').toUpperCase(),
                style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
            const SizedBox(height: 6),
            Text(c['card_name'] as String? ?? '', style: displayStyle(size: 26, color: Colors.white)),
            const SizedBox(height: 6),
            Text(c['benefit_description'] as String? ?? '', style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 15)),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(999)),
              child: Text('${c['stamps_required']} sellos para completar', style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}
