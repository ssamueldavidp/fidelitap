import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';
import '../core/supabase_client.dart';
import 'widgets/loyalty_card_widget.dart';

class CardListScreen extends StatefulWidget {
  const CardListScreen({super.key});

  @override
  State<CardListScreen> createState() => _CardListScreenState();
}

class _CardListScreenState extends State<CardListScreen> {
  List<dynamic> _cards = [];
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
      final res = await MobileApiClient().get('/api/mobile/customer-cards');
      setState(() {
        _cards = res['cards'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } on Exception catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _logout() async {
    await supabase.auth.signOut();
    if (mounted) Navigator.of(context).pushReplacementNamed('/');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis tarjetas'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
          IconButton(
            onPressed: () => Navigator.of(context).pushNamed('/auth/claim'),
            icon: const Icon(Icons.add),
          ),
          IconButton(onPressed: _logout, icon: const Icon(Icons.logout)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C896)))
          : _error != null
              ? Center(child: Text('Error: $_error'))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: const Color(0xFF00C896),
                  child: _cards.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(height: 80),
                            Center(
                              child: Column(children: [
                                Icon(Icons.credit_card_off_outlined,
                                    size: 64, color: Color(0xFF475569)),
                                SizedBox(height: 16),
                                Text('No tienes tarjetas aún',
                                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 16)),
                              ]),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _cards.length,
                          itemBuilder: (ctx, i) {
                            final card = _cards[i] as Map<String, dynamic>;
                            final lc = card['loyalty_cards'] as Map<String, dynamic>? ?? {};
                            final biz = lc['businesses'] as Map<String, dynamic>? ?? {};
                            final design = lc['design_config'] as Map<String, dynamic>? ?? {};

                            Color cardColor;
                            try {
                              final hex = (design['color'] as String? ?? '#00C896')
                                  .replaceFirst('#', '');
                              cardColor = Color(int.parse('FF$hex', radix: 16));
                            } catch (_) {
                              cardColor = const Color(0xFF00C896);
                            }

                            return LoyaltyCardWidget(
                              businessName: biz['name'] as String? ?? '',
                              cardName: lc['name'] as String? ?? '',
                              benefitDescription:
                                  lc['benefit_description'] as String? ?? '',
                              currentStamps: card['current_stamps'] as int? ?? 0,
                              stampsRequired: lc['stamps_required'] as int? ?? 1,
                              stampIcon: design['stamp_icon'] as String? ?? '⭐',
                              color: cardColor,
                              bgMode: design['bg_mode'] as String? ?? 'dark',
                              status: card['status'] as String? ?? 'active',
                            );
                          },
                        ),
                ),
    );
  }
}
