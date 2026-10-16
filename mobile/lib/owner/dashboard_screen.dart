import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';
import '../core/app_colors.dart';
import '../core/theme.dart';
import '../shared/ui.dart';
import 'campaigns_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, this.onOpenTab});

  /// Cambia de pestaña en la barra inferior (1 = Tarjetas, 2 = Escanear, 3 = Clientes).
  final ValueChanged<int>? onOpenTab;

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
      if (!mounted) return;
      setState(() { _data = res; _loading = false; });
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final m = _data?['metrics'] as Map<String, dynamic>?;
    final ov = _data?['overview'] as Map<String, dynamic>?;
    final name = _data?['businessName'] as String? ?? 'Mi negocio';
    final today = (ov?['stampsToday'] as num?)?.toInt() ?? 0;
    final yesterday = (ov?['stampsYesterday'] as num?)?.toInt() ?? 0;
    final rewardsMonth = (ov?['rewardsThisMonth'] as num?)?.toInt() ?? 0;
    final delta = today - yesterday;
    final activity = (ov?['activity'] as List?)?.cast<Map<String, dynamic>>() ?? const [];

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: _loading && _data == null
            ? Center(child: CircularProgressIndicator(color: c.brand))
            : _error != null && _data == null
                ? _ErrorState(message: _error!, onRetry: _load)
                : RefreshIndicator(
                    onRefresh: _load,
                    color: c.brand,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                      children: [
                        _Header(greeting: _greeting(), name: name),
                        const SizedBox(height: 20),
                        _TodayCard(today: today, delta: delta, rewardsMonth: rewardsMonth),
                        const SizedBox(height: 16),
                        Row(children: [
                          Expanded(
                            child: _KpiTile(
                              icon: Icons.people_outline_rounded,
                              value: '${m?['activos'] ?? 0}',
                              label: 'Clientes activos',
                              fg: c.sky,
                              bg: c.skySoft,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _KpiTile(
                              icon: Icons.card_giftcard_rounded,
                              value: '${m?['canjes_totales'] ?? 0}',
                              label: 'Premios canjeados',
                              fg: c.sun,
                              bg: c.sunSoft,
                            ),
                          ),
                        ]),
                        const SizedBox(height: 12),
                        _KpiTile(
                          icon: Icons.trending_up_rounded,
                          value: '${m?['retencion_pct'] ?? 0}%',
                          label: 'Clientes que regresan en 30 días',
                          fg: c.lilac,
                          bg: c.lilacSoft,
                          wide: true,
                        ),
                        const SizedBox(height: 28),
                        const SectionHeader('Accesos rápidos'),
                        const SizedBox(height: 14),
                        SizedBox(
                          height: 108,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            clipBehavior: Clip.none,
                            children: [
                              _QuickAction(icon: Icons.qr_code_scanner_rounded, label: 'Dar sello', fg: c.onBrand, solid: c.brand, soft: c.brandSoft, onTap: () => widget.onOpenTab?.call(2)),
                              _QuickAction(icon: Icons.add_card_rounded, label: 'Nueva tarjeta', fg: Colors.white, solid: c.sun, soft: c.sunSoft, onTap: () => widget.onOpenTab?.call(1)),
                              _QuickAction(
                                icon: Icons.campaign_outlined,
                                label: 'Campaña',
                                fg: Colors.white,
                                solid: c.coral,
                                soft: c.coralSoft,
                                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CampaignsScreen())),
                              ),
                              _QuickAction(icon: Icons.qr_code_2_rounded, label: 'Cartel QR', fg: Colors.white, solid: c.lilac, soft: c.lilacSoft, onTap: () => widget.onOpenTab?.call(1)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 28),
                        SectionHeader('Actividad reciente', action: 'Ver clientes', onAction: () => widget.onOpenTab?.call(3)),
                        const SizedBox(height: 12),
                        if (activity.isEmpty)
                          AppCard(
                            child: Column(children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(shape: BoxShape.circle, color: c.brandSoft),
                                child: Icon(Icons.auto_awesome_rounded, color: c.brand),
                              ),
                              const SizedBox(height: 12),
                              Text('Aún no hay actividad', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700, fontSize: 15)),
                              const SizedBox(height: 4),
                              Text('Cuando des el primer sello, aparecerá aquí.', textAlign: TextAlign.center, style: TextStyle(color: c.textMuted, fontSize: 13)),
                            ]),
                          )
                        else
                          AppCard(
                            padding: const EdgeInsets.all(8),
                            child: Column(children: [for (final a in activity) _ActivityRow(item: a)]),
                          ),
                      ],
                    ),
                  ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.greeting, required this.name});
  final String greeting;
  final String name;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(children: [
      Container(
        width: 48,
        height: 48,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(colors: [Color(0xFF34D399), Color(0xFF0A9F5B)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        ),
        child: Text(name.isEmpty ? 'F' : name.characters.first.toUpperCase(), style: displayStyle(size: 20, color: Colors.white)),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(greeting, style: TextStyle(color: c.textMuted, fontSize: 13, fontWeight: FontWeight.w600)),
          Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: displayStyle(size: 22, color: c.textPrimary)),
        ]),
      ),
    ]);
  }
}

class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.today, required this.delta, required this.rewardsMonth});
  final int today;
  final int delta;
  final int rewardsMonth;

  @override
  Widget build(BuildContext context) {
    final deltaLabel = delta == 0 ? 'Igual que ayer' : '${delta > 0 ? '+' : ''}$delta vs ayer';
    return GradientHero(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 8, height: 8, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFBFFFE0))),
          const SizedBox(width: 8),
          const Text('HOY', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
        ]),
        const SizedBox(height: 8),
        Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
          Text('$today', style: displayStyle(size: 58, color: Colors.white, height: 1)),
          const SizedBox(width: 10),
          Text(today == 1 ? 'sello dado' : 'sellos dados', style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 14),
        Wrap(spacing: 10, runSpacing: 8, children: [
          _Pill(deltaLabel),
          _Pill('$rewardsMonth ${rewardsMonth == 1 ? 'premio' : 'premios'} este mes'),
        ]),
      ]),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(999)),
        child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
      );
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({required this.icon, required this.value, required this.label, required this.fg, required this.bg, this.wide = false});
  final IconData icon;
  final String value;
  final String label;
  final Color fg;
  final Color bg;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final iconBox = Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
      child: Icon(icon, color: fg, size: 22),
    );
    return AppCard(
      padding: const EdgeInsets.all(16),
      radius: 22,
      child: wide
          ? Row(children: [
              iconBox,
              const SizedBox(width: 14),
              Expanded(child: Text(label, style: TextStyle(color: c.textMuted, fontSize: 13, fontWeight: FontWeight.w600))),
              Text(value, style: displayStyle(size: 30, color: c.textPrimary)),
            ])
          : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              iconBox,
              const SizedBox(height: 12),
              Text(value, style: displayStyle(size: 30, color: c.textPrimary, height: 1)),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(color: c.textMuted, fontSize: 13, fontWeight: FontWeight.w600)),
            ]),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({required this.icon, required this.label, required this.fg, required this.solid, required this.soft, required this.onTap});
  final IconData icon;
  final String label;
  final Color fg;
  final Color solid;
  final Color soft;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: Material(
        color: soft,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: onTap,
          child: SizedBox(
            width: 112,
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(shape: BoxShape.circle, color: solid),
                child: Icon(icon, color: fg, size: 22),
              ),
              const SizedBox(height: 10),
              Text(label, style: TextStyle(color: c.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.item});
  final Map<String, dynamic> item;

  String _ago(String iso) {
    final t = DateTime.tryParse(iso);
    if (t == null) return '';
    final mins = DateTime.now().difference(t).inMinutes;
    if (mins < 1) return 'ahora';
    if (mins < 60) return 'hace $mins min';
    final h = (mins / 60).round();
    if (h < 24) return 'hace $h h';
    return 'hace ${(h / 24).round()} d';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isReward = item['kind'] == 'reward';
    final who = item['who'] as String? ?? 'Cliente';
    return Padding(
      padding: const EdgeInsets.all(10),
      child: Row(children: [
        InitialAvatar(who, background: isReward ? c.sunSoft : c.brandSoft, foreground: isReward ? c.sun : c.brand),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(who, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 1),
            Text(isReward ? 'canjeó su premio' : 'sumó 1 sello', style: TextStyle(color: c.textMuted, fontSize: 13)),
          ]),
        ),
        Text(_ago(item['at'] as String? ?? ''), style: TextStyle(color: c.textMuted, fontSize: 12)),
      ]),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.cloud_off_rounded, size: 44, color: c.textMuted),
          const SizedBox(height: 12),
          Text('No se pudo cargar tu resumen', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          SizedBox(width: 180, child: ElevatedButton(onPressed: onRetry, child: const Text('Reintentar'))),
        ]),
      ),
    );
  }
}
