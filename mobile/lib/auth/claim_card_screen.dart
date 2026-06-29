import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../core/supabase_client.dart';

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
            : 'No se pudo vincular la tarjeta';
        _cameraActive = true;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agregar tarjeta')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Text('Escanea el código QR de tu tarjeta',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
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
                      color: const Color(0xFF1E293B),
                      child: const Center(
                          child: CircularProgressIndicator(color: Color(0xFF00C896)))),
            ),
          ),
          const SizedBox(height: 24),
          const Row(children: [
            Expanded(child: Divider()),
            Padding(padding: EdgeInsets.symmetric(horizontal: 12),
                child: Text('o', style: TextStyle(color: Color(0xFF64748B)))),
            Expanded(child: Divider()),
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
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF450A0A),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(_error!, style: const TextStyle(color: Color(0xFFFCA5A5))),
            ),
          ],
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _loading ? null : () => _claim(_codeController.text),
            child: _loading
                ? const SizedBox(height: 20, width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                : const Text('Vincular tarjeta'),
          ),
        ],
      ),
    );
  }
}
