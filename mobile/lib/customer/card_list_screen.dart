import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/mobile_api_client.dart';
import '../core/supabase_client.dart';
import '../core/notification_service.dart';
import '../core/app_colors.dart';
import '../core/theme.dart';
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

  Future<void> _addToWallet(String customerCardId, String cardName, {required bool apple}) async {
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

      final url = apple ? data['apple_url'] as String : data['google_url'] as String;

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
                            color: done ? const Color(0xFF0A9F5B) : barColor,
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
                        done ? const Color(0xFF0A9F5B) : barColor,
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
    final colors = context.colors;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
            child: Row(children: [
              Expanded(child: Text('Mis tarjetas', style: displayStyle(size: 28, color: colors.textPrimary))),
              IconButton(onPressed: _load, tooltip: 'Actualizar', icon: Icon(Icons.refresh_rounded, color: colors.textPrimary)),
              IconButton(
                onPressed: () => Navigator.of(context).pushNamed('/auth/claim'),
                tooltip: 'Agregar tarjeta',
                icon: Icon(Icons.add_circle_outline_rounded, color: colors.textPrimary),
              ),
              IconButton(onPressed: _logout, tooltip: 'Cerrar sesión', icon: Icon(Icons.logout_rounded, color: colors.textPrimary)),
            ]),
          ),
          Expanded(child: _content()),
        ]),
      ),
    );
  }

  Widget _content() {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF0A9F5B)))
          : _error != null
              ? Center(child: Text('Error: $_error'))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: const Color(0xFF0A9F5B),
                  child: _cards.isEmpty
                      ? ListView(
                          padding: const EdgeInsets.fromLTRB(28, 56, 28, 120),
                          children: [
                            Center(
                              child: Container(
                                width: 96,
                                height: 96,
                                decoration: BoxDecoration(shape: BoxShape.circle, color: context.colors.brandSoft),
                                child: Icon(Icons.credit_card_rounded, size: 44, color: context.colors.brand),
                              ),
                            ),
                            const SizedBox(height: 24),
                            Text('Aún no tienes tarjetas',
                                textAlign: TextAlign.center,
                                style: displayStyle(size: 24, color: context.colors.textPrimary)),
                            const SizedBox(height: 8),
                            Text('Escanea el QR de un negocio o descubre tiendas cerca de ti para empezar a juntar sellos.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: context.colors.textMuted, fontSize: 15, height: 1.4)),
                            const SizedBox(height: 28),
                            ElevatedButton.icon(
                              onPressed: () => Navigator.of(context).pushNamed('/auth/claim'),
                              icon: const Icon(Icons.qr_code_scanner_rounded),
                              label: const Text('Escanear QR de un negocio'),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
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
                                              style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
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
                                  loading: isWalletLoading,
                                  onApple: () => _addToWallet(cardId, lc['name'] as String? ?? 'Tarjeta', apple: true),
                                  onGoogle: () => _addToWallet(cardId, lc['name'] as String? ?? 'Tarjeta', apple: false),
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

/// Botones para agregar la tarjeta al Wallet del teléfono.
/// - Google Wallet: botón oficial de Google (SVG sin modificar).
/// - Apple Wallet: la insignia oficial de Apple (`assets/wallet/add_to_apple_wallet.svg`,
///   que Apple entrega bajo su licencia de arte de marketing). Mientras ese archivo no esté,
///   se muestra un botón negro provisional.
/// En iOS se muestra solo el de Apple, en Android solo el de Google; en web/escritorio ambos.
class _WalletButton extends StatelessWidget {
  final bool loading;
  final VoidCallback onApple;
  final VoidCallback onGoogle;
  const _WalletButton({required this.loading, required this.onApple, required this.onGoogle});

  @override
  Widget build(BuildContext context) {
    final platform = defaultTargetPlatform;
    final showApple = kIsWeb || platform == TargetPlatform.iOS || platform == TargetPlatform.macOS;
    final showGoogle = kIsWeb || platform != TargetPlatform.iOS && platform != TargetPlatform.macOS;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (loading)
        const SizedBox(height: 50, child: Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5))))
      else ...[
        if (showApple) _AppleBadge(onTap: onApple),
        if (showApple && showGoogle) const SizedBox(height: 12),
        if (showGoogle)
          GestureDetector(
            onTap: onGoogle,
            child: Semantics(
              button: true,
              label: 'Agregar a Google Wallet',
              child: SvgPicture.asset('assets/wallet/add_to_google_wallet.svg', height: 52, fit: BoxFit.contain),
            ),
          ),
      ],
    ]);
  }
}

class _AppleBadge extends StatelessWidget {
  final VoidCallback onTap;
  const _AppleBadge({required this.onTap});

  Future<bool> _hasOfficialBadge() async {
    try {
      await rootBundle.load('assets/wallet/add_to_apple_wallet.svg');
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: _hasOfficialBadge(),
      builder: (context, snap) {
        if (snap.data == true) {
          return GestureDetector(
            onTap: onTap,
            child: Semantics(
              button: true,
              label: 'Agregar a Apple Wallet',
              child: SvgPicture.asset('assets/wallet/add_to_apple_wallet.svg', height: 52, fit: BoxFit.contain),
            ),
          );
        }
        // Provisional hasta contar con la insignia oficial de Apple.
        return GestureDetector(
          onTap: onTap,
          child: Container(
            height: 52,
            decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(999)),
            child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.wallet, color: Colors.white, size: 20),
              SizedBox(width: 8),
              Text('Agregar a Apple Wallet', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
            ]),
          ),
        );
      },
    );
  }
}
