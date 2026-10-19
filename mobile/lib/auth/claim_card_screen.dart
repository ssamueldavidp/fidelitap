import 'package:flutter/material.dart';
import '../core/app_colors.dart';
import '../shared/auth_ui.dart';

import 'package:mobile_scanner/mobile_scanner.dart';
import '../core/supabase_client.dart';
import '../core/auth_error.dart';
import 'activate_card_screen.dart';

/// A business's activation QR encodes {APP_URL}/c/{slug} (see
/// src/components/cards/card-drawer.tsx). A customer's own card QR encodes
/// their raw unique_code (a long hex string, no slashes). Scanning either
/// one should work from this same screen — this tells them apart.
String? _extractBusinessSlug(String scanned) {
  final match = RegExp(r'/c/([^/?#]+)').firstMatch(scanned);
  return match?.group(1);
}

class ClaimCardScreen extends StatefulWidget {
  const ClaimCardScreen({super.key});

  @override
  State<ClaimCardScreen> createState() => _ClaimCardScreenState();
}

class _ClaimCardScreenState extends State<ClaimCardScreen> {
  final _codeController = TextEditingController();
  bool _loading = false;
  bool _cameraActive = true;
  String? _error;

  Future<void> _claim(String code) async {
    if (code.trim().isEmpty) return;

    final slug = _extractBusinessSlug(code.trim());
    if (slug != null) {
      setState(() { _cameraActive = false; });
      if (mounted) {
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => ActivateCardScreen(slug: slug)),
        );
      }
      if (mounted) setState(() => _cameraActive = true);
      return;
    }

    setState(() { _loading = true; _error = null; _cameraActive = false; });
    try {
      if (supabase.auth.currentUser == null) {
        await supabase.auth.signInAnonymously();
      }
      final result = await supabase.rpc(
        'claim_customer_card',
        params: {'p_unique_code': code.trim()},
      );
      if (result == null || (result as List).isEmpty) {
        setState(() { _error = 'Código no encontrado'; _cameraActive = true; });
        return;
      }
      if (mounted) Navigator.of(context).pushReplacementNamed('/');
    } on Exception catch (e) {
      setState(() {
        _error = e.toString().contains('No autenticado')
            ? 'Error de sesión, intenta de nuevo'
            : friendlyAuthError(e);
        _cameraActive = true;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AuthScaffold(
      title: 'Agrega tu tarjeta',
      subtitle: 'Escanea el QR del negocio para activarla, o ingresa tu código si ya tienes una.',
      children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(28),
            child: SizedBox(
              height: 260,
              child: _cameraActive
                  ? MobileScanner(
                      onDetect: (capture) {
                        final code = capture.barcodes.firstOrNull?.rawValue;
                        if (code != null && !_loading) _claim(code);
                      },
                    )
                  : Container(
                      color: c.surfaceAlt,
                      child: const Center(
                          child: CircularProgressIndicator(color: Color(0xFF0A9F5B)))),
            ),
          ),
          const SizedBox(height: 24),
          Row(children: [
            Expanded(child: Divider(color: c.divider)),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text('o', style: TextStyle(color: c.textMuted))),
            Expanded(child: Divider(color: c.divider)),
          ]),
          const SizedBox(height: 16),
          TextField(
            controller: _codeController,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(
              hintText: 'Ingresa el código manualmente',
              prefixIcon: Icon(Icons.keyboard_outlined),
            ),
          ),
          if (_error != null) AuthError(_error!),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _loading ? null : () => _claim(_codeController.text),
            child: _loading
                ? SizedBox(height: 20, width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: c.onBrand))
                : const Text('Vincular tarjeta'),
          ),
      ],
    );
  }
}
