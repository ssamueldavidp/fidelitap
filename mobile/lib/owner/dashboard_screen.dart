import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await MobileApiClient().get('/api/mobile/dashboard-summary');
      setState(() { _data = res; _loading = false; });
    } on Exception catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = _data?['metrics'] as Map<String, dynamic>?;
    final name = _data?['businessName'] as String? ?? 'Mi negocio';

    return Scaffold(
      appBar: AppBar(
        title: Text(name),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C896)))
          : _error != null
              ? Center(child: Text('Error: $_error'))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: const Color(0xFF00C896),
                  child: ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      const Text('Resumen', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 20),
                      GridView.count(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisCount: 2,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 1.3,
                        children: [
                          _MetricCard(
                            label: 'Clientes activos',
                            value: '${m?['activos'] ?? 0}',
                            icon: Icons.people_outline,
                            color: const Color(0xFF60A5FA),
                          ),
                          _MetricCard(
                            label: 'Sellos hoy',
                            value: '${m?['sellos_hoy'] ?? 0}',
                            icon: Icons.star_outline,
                            color: const Color(0xFF00C896),
                          ),
                          _MetricCard(
                            label: 'Canjes totales',
                            value: '${m?['canjes_totales'] ?? 0}',
                            icon: Icons.card_giftcard_outlined,
                            color: const Color(0xFFFBBF24),
                          ),
                          _MetricCard(
                            label: 'Retención 30d',
                            value: '${m?['retencion_pct'] ?? 0}%',
                            icon: Icons.trending_up,
                            color: const Color(0xFFA78BFA),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 4),
            Text(value,
                style: TextStyle(
                    fontSize: 24, fontWeight: FontWeight.w800, color: color)),
            Text(label,
                style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
          ],
        ),
      ),
    );
  }
}
