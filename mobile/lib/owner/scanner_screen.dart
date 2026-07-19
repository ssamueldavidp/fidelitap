import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../data/mobile_api_client.dart';

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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Escanear cliente'),
        actions: [
          if (_result != null || _error != null)
            TextButton(onPressed: _reset, child: const Text('Nuevo')),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (_result == null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: SizedBox(
                height: 240,
                child: _cameraOn && !_loading
                    ? MobileScanner(
                        onDetect: (capture) {
                          final code = capture.barcodes.firstOrNull?.rawValue;
                          if (code != null && !_loading) _stamp(code);
                        },
                      )
                    : Container(
                        color: const Color(0xFF1E293B),
                        child: const Center(
                            child: CircularProgressIndicator(color: Color(0xFF00C896)))),
              ),
            ),
            const SizedBox(height: 20),
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
                hintText: 'Código QR del cliente',
                prefixIcon: Icon(Icons.qr_code),
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
            ElevatedButton.icon(
              onPressed: _loading ? null : () => _stamp(_codeController.text),
              icon: const Icon(Icons.star),
              label: _loading
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
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
    final current = result['currentStamps'] as int? ?? 0;
    final required = result['stampsRequired'] as int? ?? 1;
    final name = result['customerName'] as String? ?? 'Cliente';
    final status = result['status'] as String? ?? 'active';
    final isReadyToClaim = status == 'ready_to_claim';
    final isClaimed = status == 'claimed';
    final progress = current / required;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const Icon(Icons.check_circle, color: Color(0xFF00C896), size: 48),
            const SizedBox(height: 12),
            Text('¡Sello agregado!',
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(name, style: const TextStyle(color: Color(0xFF94A3B8))),
            const SizedBox(height: 20),
            LinearProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              minHeight: 8,
              borderRadius: BorderRadius.circular(4),
              backgroundColor: const Color(0xFF334155),
              color: isReadyToClaim ? const Color(0xFFFBBF24) : const Color(0xFF00C896),
            ),
            const SizedBox(height: 8),
            Text('$current / $required sellos',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            if (isReadyToClaim && !isClaimed) ...[
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF451A03),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('🎉 ¡Tarjeta completa! Cliente listo para reclamar su premio.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFFFBBF24), fontWeight: FontWeight.w600)),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: loading ? null : onClaim,
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFBBF24)),
                icon: const Icon(Icons.card_giftcard),
                label: loading
                    ? const SizedBox(height: 20, width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                    : const Text('Entregar premio'),
              ),
            ],
            if (isClaimed) ...[
              const SizedBox(height: 16),
              const Text('✅ Premio entregado',
                  style: TextStyle(color: Color(0xFF00C896), fontWeight: FontWeight.w600)),
            ],
          ],
        ),
      ),
    );
  }
}
