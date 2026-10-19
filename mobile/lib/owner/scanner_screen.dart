import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../data/mobile_api_client.dart';
import '../core/app_colors.dart';
import '../core/theme.dart';
import '../shared/auth_ui.dart';
import '../shared/ui.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final _codeController = TextEditingController();
  bool _loading = false;
  bool _cameraOn = true;
  Map<String, dynamic>? _result;
  String? _error;

  Future<void> _stamp(String code) async {
    if (code.trim().isEmpty) return;
    setState(() { _loading = true; _error = null; _result = null; _cameraOn = false; });
    try {
      final res = await MobileApiClient().post('/api/mobile/add-stamp', {'uniqueCode': code.trim()});
      if (res.containsKey('error')) {
        setState(() { _error = res['error'] as String; _cameraOn = true; });
      } else {
        setState(() => _result = res);
      }
    } on Exception catch (e) {
      setState(() { _error = e.toString(); _cameraOn = true; });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _claimReward(String customerCardId) async {
    setState(() => _loading = true);
    try {
      final res = await MobileApiClient().post('/api/mobile/claim-reward', {'customerCardId': customerCardId});
      if (res.containsKey('error')) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['error'] as String)));
        }
      } else {
        setState(() {
          _result = {...?_result, 'status': res['status'], 'timesCompleted': res['timesCompleted']};
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _reset() {
    setState(() { _result = null; _error = null; _cameraOn = true; _codeController.clear(); });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
          children: [
            Row(children: [
              Expanded(child: Text('Escanear cliente', style: displayStyle(size: 28, color: c.textPrimary))),
              if (_result != null || _error != null)
                TextButton.icon(onPressed: _reset, icon: const Icon(Icons.refresh_rounded, size: 18), label: const Text('Nuevo')),
            ]),
            const SizedBox(height: 4),
            Text('Apunta la cámara al QR de la tarjeta del cliente.', style: TextStyle(color: c.textMuted, fontSize: 14)),
            const SizedBox(height: 18),
            if (_result == null) ...[
              AspectRatio(
                aspectRatio: 1,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(32),
                  child: Stack(fit: StackFit.expand, children: [
                    _cameraOn && !_loading
                        ? MobileScanner(
                            onDetect: (capture) {
                              final code = capture.barcodes.firstOrNull?.rawValue;
                              if (code != null && !_loading) _stamp(code);
                            },
                          )
                        : Container(color: c.surfaceAlt, child: Center(child: CircularProgressIndicator(color: c.brand))),
                    // Marco de enfoque
                    Center(
                      child: Container(
                        width: 200,
                        height: 200,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(28),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 3),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: 22),
              Row(children: [
                Expanded(child: Divider(color: c.divider)),
                Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text('o ingresa el código', style: TextStyle(color: c.textMuted, fontSize: 13))),
                Expanded(child: Divider(color: c.divider)),
              ]),
              const SizedBox(height: 16),
              TextField(
                controller: _codeController,
                textCapitalization: TextCapitalization.characters,
                onSubmitted: (v) => _loading ? null : _stamp(v),
                decoration: const InputDecoration(
                  hintText: 'Código QR del cliente',
                  prefixIcon: Icon(Icons.qr_code_rounded),
                ),
              ),
              if (_error != null) AuthError(_error!),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _loading ? null : () => _stamp(_codeController.text),
                icon: const Icon(Icons.add_circle_outline_rounded),
                label: _loading
                    ? SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: c.onBrand))
                    : const Text('Agregar sello'),
              ),
            ] else ...[
              _StampResultCard(
                result: _result!,
                onClaim: () => _claimReward(_result!['customerCardId'] as String),
                loading: _loading,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StampResultCard extends StatelessWidget {
  const _StampResultCard({
    required this.result,
    required this.onClaim,
    required this.loading,
  });

  final Map<String, dynamic> result;
  final VoidCallback onClaim;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final current = result['currentStamps'] as int? ?? 0;
    final required = result['stampsRequired'] as int? ?? 1;
    final name = result['customerName'] as String? ?? 'Cliente';
    final status = result['status'] as String? ?? 'active';
    final isReadyToClaim = status == 'ready_to_claim';
    final isClaimed = status == 'claimed';
    final progress = required > 0 ? current / required : 0.0;

    return Column(children: [
      GradientHero(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.2)),
              child: const Icon(Icons.check_rounded, color: Colors.white, size: 26),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('¡Sello agregado!', style: displayStyle(size: 22, color: Colors.white)),
                Text(name, style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 14)),
              ]),
            ),
          ]),
          const SizedBox(height: 20),
          Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
            Text('$current', style: displayStyle(size: 52, color: Colors.white, height: 1)),
            Text(' / $required sellos', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              minHeight: 10,
              backgroundColor: Colors.white.withValues(alpha: 0.25),
              color: isReadyToClaim ? const Color(0xFFFFD36E) : Colors.white,
            ),
          ),
        ]),
      ),
      if (isReadyToClaim && !isClaimed) ...[
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: c.sunSoft, borderRadius: BorderRadius.circular(22)),
          child: Text('¡Tarjeta completa! El cliente está listo para reclamar su premio.',
              textAlign: TextAlign.center, style: TextStyle(color: c.sun, fontWeight: FontWeight.w700, fontSize: 15)),
        ),
        const SizedBox(height: 14),
        ElevatedButton.icon(
          onPressed: loading ? null : onClaim,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF59E0B), foregroundColor: Colors.white),
          icon: const Icon(Icons.card_giftcard_rounded),
          label: loading
              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
              : const Text('Entregar premio'),
        ),
      ],
      if (isClaimed) ...[
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: c.brandSoft, borderRadius: BorderRadius.circular(22)),
          child: Text('Premio entregado', textAlign: TextAlign.center, style: TextStyle(color: c.brand, fontWeight: FontWeight.w800, fontSize: 15)),
        ),
      ],
    ]);
  }
}
