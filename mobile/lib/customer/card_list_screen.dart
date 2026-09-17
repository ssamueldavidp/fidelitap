import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/mobile_api_client.dart';
import '../core/supabase_client.dart';
import '../core/notification_service.dart';
import '../core/app_colors.dart';
import '../shared/wallet_preview_card.dart';

class CardListScreen extends StatefulWidget {
  const CardListScreen({super.key});

  @override
  State<CardListScreen> createState() => _CardListScreenState();
}

class _CardListScreenState extends State<CardListScreen> {
  List<dynamic> _cards = [];
  bool _loading = true;
  String? _error;
  final Set<String> _walletLoading = {};

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

  Future<void> _addToWallet(String customerCardId, String cardName) async {
    setState(() => _walletLoading.add(customerCardId));
    try {
      final res = await MobileApiClient().get('/api/mobile/wallet-link/$customerCardId');
      final data = res as Map<String, dynamic>;
      if (data.containsKey('error')) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(data['error'] as String)),
          );
        }
        return;
      }

      final url = defaultTargetPlatform == TargetPlatform.iOS
          ? data['apple_url'] as String
          : data['google_url'] as String;

      final launched = await launchUrl(
        Uri.parse(url),
        mode: LaunchMode.externalApplication,
      );

      if (launched) {
        await showWalletAddedNotification(cardName: cardName);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No se pudo abrir el Wallet')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _walletLoading.remove(customerCardId));
    }
  }

  Widget _buildRewardProgress(
    Map<String, dynamic> lc,
    Map<String, dynamic> design,
    int currentStamps,
  ) {
    final multiRewards = design['multi_rewards'] as bool? ?? false;
    final rawRewards = lc['card_rewards'] as List<dynamic>? ?? [];
    if (!multiRewards || rawRewards.isEmpty) return const SizedBox.shrink();

    final rewards = rawRewards
        .map((r) => r as Map<String, dynamic>)
        .toList()
      ..sort((a, b) =>
          ((a['sort_order'] as int? ?? 0)).compareTo(b['sort_order'] as int? ?? 0));

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        children: rewards.map((r) {
          final stampsRequired = r['stamps_required'] as int? ?? 1;
          final rewardLabel = r['reward_label'] as String? ?? '';
          final hex = (r['color'] as String? ?? '#00C896').replaceAll('#', '');
          final barColor = Color(int.tryParse('FF$hex', radix: 16) ?? 0xFF00C896);
          final progress = (currentStamps / stampsRequired).clamp(0.0, 1.0);
          final done = currentStamps >= stampsRequired;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '$currentStamps/$stampsRequired sellos',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.white.withValues(alpha: 0.5),
                        ),
                      ),
                      Row(children: [
                        if (done) const Text('✅ ', style: TextStyle(fontSize: 10)),
                        Text(
                          rewardLabel,
                          style: TextStyle(
                            fontSize: 11,
                            color: done ? const Color(0xFF00C896) : barColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ]),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: progress,
                      backgroundColor: Colors.white.withValues(alpha: 0.08),
                      valueColor: AlwaysStoppedAnimation<Color>(
                        done ? const Color(0xFF00C896) : barColor,
                      ),
                      minHeight: 4,
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
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
                          children: [
                            const SizedBox(height: 80),
                            Center(
                              child: Column(children: [
                                Icon(Icons.credit_card_off_outlined,
                                    size: 64, color: context.colors.textMuted),
                                const SizedBox(height: 16),
                                Text('No tienes tarjetas aún',
                                    style: TextStyle(
                                        color: context.colors.textSecondary, fontSize: 16)),
                              ]),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                          itemCount: _cards.length,
                          itemBuilder: (ctx, i) {
                            final card = _cards[i] as Map<String, dynamic>;
                            final cardId = card['id'] as String;
                            final lc =
                                card['loyalty_cards'] as Map<String, dynamic>? ?? {};
                            final biz =
                                lc['businesses'] as Map<String, dynamic>? ?? {};
                            final design =
                                lc['design_config'] as Map<String, dynamic>? ?? {};
                            final currentStamps = card['current_stamps'] as int? ?? 0;

                            final cardColor = hexToColor(design['color'] as String? ?? '#00C896');
                            final isWalletLoading = _walletLoading.contains(cardId);
                            final status = card['status'] as String? ?? 'active';
                            final isComplete = status == 'ready_to_claim' || status == 'claimed';

                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Stack(
                                  children: [
                                    Container(
                                      decoration: isComplete
                                          ? BoxDecoration(
                                              borderRadius: BorderRadius.circular(22),
                                              border: Border.all(color: const Color(0xFFFBBF24), width: 2),
                                            )
                                          : null,
                                      padding: isComplete ? const EdgeInsets.all(2) : EdgeInsets.zero,
                                      child: WalletPreviewCard(
                                        businessName: biz['name'] as String? ?? '',
                                        name: lc['name'] as String? ?? '',
                                        benefitDescription:
                                            lc['benefit_description'] as String? ?? '',
                                        stampsRequired: lc['stamps_required'] as int? ?? 1,
                                        stampIcon: design['stamp_icon'] as String? ?? '⭐',
                                        color: cardColor,
                                        cardStyle: cardStyleFromString(design['style'] as String?),
                                        bgMode: design['bg_mode'] as String? ?? 'light',
                                        bgType: design['bg_type'] as String? ?? 'solid',
                                        bgImageUrl: design['bg_image_url'] as String?,
                                        logoUrl: design['logo_url'] as String?,
                                        filledStamps: currentStamps,
                                      ),
                                    ),
                                    if (isComplete)
                                      Positioned(
                                        top: 10,
                                        right: 10,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFBBF24),
                                            borderRadius: BorderRadius.circular(20),
                                          ),
                                          child: const Text('¡PREMIO!',
                                              style: TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.w800)),
                                        ),
                                      ),
                                  ],
                                ),
                                if (status == 'ready_to_claim')
                                  Padding(
                                    padding: const EdgeInsets.only(top: 10),
                                    child: Text('¡Ve al negocio a reclamar tu premio! 🎉',
                                        style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 13, fontWeight: FontWeight.w600)),
                                  ),
                                _buildRewardProgress(lc, design, currentStamps),
                                const SizedBox(height: 10),
                                _WalletButton(
                                  isIOS: defaultTargetPlatform == TargetPlatform.iOS,
                                  loading: isWalletLoading,
                                  onTap: () => _addToWallet(
                                    cardId,
                                    lc['name'] as String? ?? 'Tarjeta',
                                  ),
                                ),
                                const SizedBox(height: 24),
                              ],
                            );
                          },
                        ),
                ),
    );
  }
}

class _WalletButton extends StatelessWidget {
  final bool isIOS;
  final bool loading;
  final VoidCallback onTap;
  const _WalletButton({
    required this.isIOS,
    required this.loading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: isIOS ? Colors.black : const Color(0xFF1A73E8),
          borderRadius: BorderRadius.circular(12),
        ),
        child: loading
            ? const Center(
                child: SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    isIOS ? Icons.wallet : Icons.account_balance_wallet,
                    color: Colors.white,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isIOS ? 'Agregar a Apple Wallet' : 'Agregar a Google Wallet',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
