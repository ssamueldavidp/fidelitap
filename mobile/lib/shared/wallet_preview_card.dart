import 'package:flutter/material.dart';

/// Single source of truth for how a loyalty card LOOKS, ported field-for-field
/// from src/components/cards/wallet-preview.tsx (the web card editor's live
/// preview). Used by both the owner's create/edit preview and the customer's
/// card list — before this, each had its own simplified rendering that only
/// understood a light/dark toggle and ignored `style` entirely, so a card
/// styled "Luxury" on the web looked identical to "Clean" in the app.
enum CardStyle { clean, modern, luxury, editorial, minimal }

CardStyle cardStyleFromString(String? s) {
  switch (s) {
    case 'modern': return CardStyle.modern;
    case 'luxury': return CardStyle.luxury;
    case 'editorial': return CardStyle.editorial;
    case 'minimal': return CardStyle.minimal;
    default: return CardStyle.clean;
  }
}

String cardStyleToString(CardStyle s) => s.name;

Color hexToColor(String hex, {Color fallback = const Color(0xFF00C896)}) {
  final h = hex.replaceAll('#', '');
  if (h.length != 6) return fallback;
  final v = int.tryParse('FF$h', radix: 16);
  return v != null ? Color(v) : fallback;
}

class _Visuals {
  final Color nameColor;
  final Color subtleColor;
  final Color verySubtleColor;
  final Color logoBg;
  final Color? logoBorder;
  final Gradient? stampFilledGradient;
  final Color stampFilledColor;
  final Color stampFilledShadow;
  final Color stampEmptyBg;
  final Color? stampEmptyBorderColor;
  final bool stampEmptyDashed;
  final Color rewardBannerBg;
  final Color rewardBannerBorder;
  final Color rewardLabelColor;
  final Color rewardValueColor;
  final Color statLabelColor;
  final Color statValueColor;
  final Color footerBg;
  final Color footerBorder;
  final Color poweredByColor;
  final bool stampSquare;

  const _Visuals({
    required this.nameColor,
    required this.subtleColor,
    required this.verySubtleColor,
    required this.logoBg,
    this.logoBorder,
    this.stampFilledGradient,
    required this.stampFilledColor,
    required this.stampFilledShadow,
    required this.stampEmptyBg,
    this.stampEmptyBorderColor,
    required this.stampEmptyDashed,
    required this.rewardBannerBg,
    required this.rewardBannerBorder,
    required this.rewardLabelColor,
    required this.rewardValueColor,
    required this.statLabelColor,
    required this.statValueColor,
    required this.footerBg,
    required this.footerBorder,
    required this.poweredByColor,
    required this.stampSquare,
  });
}

_Visuals _getVisuals(CardStyle style, Color color, String bgMode) {
  final light = style == CardStyle.clean && bgMode == 'light';
  final minimal = style == CardStyle.minimal;
  final isLight = light || minimal;
  final luxury = style == CardStyle.luxury;
  final accentColor = luxury ? const Color(0xFFC9A227) : color;
  final rgb = color;

  return _Visuals(
    nameColor: isLight ? color : (luxury ? const Color(0xFFE8E8E8) : Colors.white),
    subtleColor: isLight ? const Color(0xFF999999) : Colors.white.withValues(alpha: 0.35),
    verySubtleColor: isLight ? const Color(0xFFBBBBBB) : Colors.white.withValues(alpha: 0.22),
    logoBg: isLight ? color : rgb.withValues(alpha: 0.18),
    logoBorder: isLight ? null : rgb.withValues(alpha: 0.3),
    stampFilledGradient: luxury
        ? const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight,
            colors: [Color(0xFFC9A227), Color(0xFFF0C940)])
        : null,
    stampFilledColor: color,
    stampFilledShadow: luxury ? const Color(0xFFC9A227).withValues(alpha: 0.45) : color.withValues(alpha: 0.4),
    stampEmptyBg: isLight ? const Color(0xFFF0F0F0) : Colors.transparent,
    stampEmptyBorderColor: isLight ? const Color(0xFFE0E0E0) : rgb.withValues(alpha: 0.25),
    stampEmptyDashed: !isLight,
    rewardBannerBg: isLight ? const Color(0xFFF0F0F0) : rgb.withValues(alpha: 0.08),
    rewardBannerBorder: isLight ? const Color(0xFFE8E8E8) : rgb.withValues(alpha: 0.16),
    rewardLabelColor: accentColor,
    rewardValueColor: isLight ? const Color(0xFF222222) : const Color(0xFFE2E8F0),
    statLabelColor: accentColor,
    statValueColor: isLight ? const Color(0xFF1A1A1A) : const Color(0xFFE2E8F0),
    footerBg: isLight ? const Color(0xFFEDE8DE) : (luxury ? const Color(0xFF060606) : Colors.black.withValues(alpha: 0.22)),
    footerBorder: isLight ? Colors.black.withValues(alpha: 0.07) : (luxury ? const Color(0xFFC9A227).withValues(alpha: 0.1) : Colors.white.withValues(alpha: 0.06)),
    poweredByColor: isLight ? const Color(0xFFAAAAAA) : Colors.white.withValues(alpha: 0.32),
    stampSquare: style == CardStyle.editorial,
  );
}

class _Shell {
  final Decoration decoration;
  final List<BoxShadow> shadow;
  final List<Widget> overlays;

  const _Shell({required this.decoration, required this.shadow, this.overlays = const []});
}

_Shell _getShell(CardStyle style, Color color, String bgMode, String bgType, String? bgImageUrl) {
  if (bgType == 'image' && bgImageUrl != null && bgImageUrl.isNotEmpty) {
    return _Shell(
      decoration: BoxDecoration(
        image: DecorationImage(
          image: NetworkImage(bgImageUrl),
          fit: BoxFit.cover,
          colorFilter: ColorFilter.mode(Colors.black.withValues(alpha: 0.6), BlendMode.darken),
        ),
      ),
      shadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 32, offset: const Offset(0, 16))],
    );
  }

  switch (style) {
    case CardStyle.clean:
      final isLight = bgMode == 'light';
      return _Shell(
        decoration: BoxDecoration(color: isLight ? const Color(0xFFF5F0E8) : const Color(0xFF111111)),
        shadow: [BoxShadow(color: Colors.black.withValues(alpha: isLight ? 0.18 : 0.5), blurRadius: 30, offset: const Offset(0, 12))],
      );
    case CardStyle.modern:
      return _Shell(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight,
              colors: [Color(0xFF080E17), Color(0xFF0D1520), Color(0xFF060F18)]),
        ),
        shadow: [
          BoxShadow(color: color.withValues(alpha: 0.12), blurRadius: 32, offset: const Offset(0, 12)),
          BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 12, offset: const Offset(0, 4)),
        ],
        overlays: [
          Positioned(top: -60, right: -60, child: _glow(200, color.withValues(alpha: 0.14))),
          Positioned(bottom: -40, left: -20, child: _glow(140, const Color(0xFF0EA5E9).withValues(alpha: 0.08))),
        ],
      );
    case CardStyle.luxury:
      return _Shell(
        decoration: const BoxDecoration(color: Color(0xFF0A0A0A)),
        shadow: [
          BoxShadow(color: const Color(0xFFC9A227).withValues(alpha: 0.1), blurRadius: 32, offset: const Offset(0, 12)),
          BoxShadow(color: Colors.black.withValues(alpha: 0.7), blurRadius: 12, offset: const Offset(0, 4)),
        ],
        overlays: [
          Positioned(top: -30, right: -20, child: _glow(120, const Color(0xFFC9A227).withValues(alpha: 0.12))),
        ],
      );
    case CardStyle.editorial:
      return _Shell(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
              colors: [Color(0xFF1A0038), Color(0xFF0D0D22), Color(0xFF001A38)]),
        ),
        shadow: [BoxShadow(color: const Color(0xFF6366F1).withValues(alpha: 0.15), blurRadius: 32, offset: const Offset(0, 12))],
        overlays: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0.5, -0.6),
                  radius: 1.1,
                  colors: [const Color(0xFF6366F1).withValues(alpha: 0.22), Colors.transparent],
                ),
              ),
            ),
          ),
        ],
      );
    case CardStyle.minimal:
      return _Shell(
        decoration: const BoxDecoration(color: Color(0xFFF8F8F8)),
        shadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 24, offset: const Offset(0, 8))],
        overlays: [
          Positioned(top: 0, left: 0, right: 0, child: Container(height: 3, color: color)),
        ],
      );
  }
}

Widget _glow(double size, Color color) => Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]),
      ),
    );

class WalletPreviewCard extends StatelessWidget {
  final String businessName;
  final String name;
  final String benefitDescription;
  final int stampsRequired;
  final String stampIcon;
  final Color color;
  final CardStyle cardStyle;
  final String bgMode;
  final String bgType;
  final String? bgImageUrl;
  final String? logoUrl;
  final int filledStamps;
  final bool compact;

  const WalletPreviewCard({
    super.key,
    required this.businessName,
    required this.name,
    required this.benefitDescription,
    required this.stampsRequired,
    required this.stampIcon,
    required this.color,
    this.cardStyle = CardStyle.clean,
    this.bgMode = 'light',
    this.bgType = 'solid',
    this.bgImageUrl,
    this.logoUrl,
    this.filledStamps = 0,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    if (stampsRequired < 1) return const SizedBox.shrink();
    final vis = _getVisuals(cardStyle, color, bgMode);
    final shell = _getShell(cardStyle, color, bgMode, bgType, bgImageUrl);
    final filled = filledStamps.clamp(0, stampsRequired);
    final remaining = (stampsRequired - filled).clamp(0, stampsRequired);

    return ClipRRect(
      borderRadius: BorderRadius.circular(compact ? 14 : 20),
      child: Container(
        decoration: BoxDecoration(boxShadow: shell.shadow),
        child: Stack(
          children: [
            Positioned.fill(child: DecoratedBox(decoration: shell.decoration)),
            ...shell.overlays,
            Padding(
              padding: EdgeInsets.all(compact ? 14 : 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              businessName.isEmpty ? 'Mi Negocio' : businessName.toUpperCase(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: vis.nameColor, fontWeight: FontWeight.w900,
                                  fontSize: compact ? 15 : 22, letterSpacing: -0.3),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              name.isEmpty ? 'Tarjeta de fidelización' : name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: vis.subtleColor, fontWeight: FontWeight.w500, fontSize: compact ? 10 : 13),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        width: compact ? 32 : 48,
                        height: compact ? 32 : 48,
                        decoration: BoxDecoration(
                          color: vis.logoBg,
                          borderRadius: BorderRadius.circular(compact ? 8 : 14),
                          border: vis.logoBorder != null ? Border.all(color: vis.logoBorder!, width: 1.5) : null,
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: (logoUrl != null && logoUrl!.isNotEmpty)
                            ? Image.network(logoUrl!, fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => Center(child: Text(stampIcon, style: TextStyle(fontSize: compact ? 16 : 24))))
                            : Center(child: Text(stampIcon, style: TextStyle(fontSize: compact ? 16 : 24))),
                      ),
                    ],
                  ),
                  SizedBox(height: compact ? 10 : 16),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 4, crossAxisSpacing: 8, mainAxisSpacing: 8),
                    itemCount: stampsRequired,
                    itemBuilder: (_, i) {
                      final active = i < filled;
                      final shape = vis.stampSquare ? BoxShape.rectangle : BoxShape.circle;
                      return DecoratedBox(
                        decoration: BoxDecoration(
                          shape: shape,
                          borderRadius: vis.stampSquare ? BorderRadius.circular(8) : null,
                          gradient: active ? vis.stampFilledGradient : null,
                          color: active ? (vis.stampFilledGradient == null ? vis.stampFilledColor : null) : vis.stampEmptyBg,
                          border: !active && vis.stampEmptyBorderColor != null
                              ? Border.all(color: vis.stampEmptyBorderColor!, width: 1.5)
                              : null,
                          boxShadow: active ? [BoxShadow(color: vis.stampFilledShadow, blurRadius: 10, offset: const Offset(0, 3))] : null,
                        ),
                        child: Center(
                          child: Opacity(
                            opacity: active ? 1 : 0.35,
                            child: Text(stampIcon, style: TextStyle(fontSize: compact ? 11 : 16)),
                          ),
                        ),
                      );
                    },
                  ),
                  if (!compact) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: vis.rewardBannerBg,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: vis.rewardBannerBorder, width: 1.5),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 32, height: 32,
                            decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(10)),
                            alignment: Alignment.center,
                            child: const Text('🎁', style: TextStyle(fontSize: 14)),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('PREMIO AL COMPLETAR', style: TextStyle(color: vis.rewardLabelColor, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
                                const SizedBox(height: 2),
                                Text(benefitDescription.isEmpty ? 'Premio especial' : benefitDescription,
                                    maxLines: 1, overflow: TextOverflow.ellipsis,
                                    style: TextStyle(color: vis.rewardValueColor, fontSize: 13, fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('$filled', style: TextStyle(color: vis.rewardLabelColor, fontSize: 18, fontWeight: FontWeight.w900, height: 1)),
                              Text('de $stampsRequired', style: TextStyle(color: vis.subtleColor, fontSize: 10)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('HASTA PRÓX PREMIO', style: TextStyle(color: vis.statLabelColor, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                              const SizedBox(height: 3),
                              RichText(text: TextSpan(children: [
                                TextSpan(text: '$remaining ', style: TextStyle(color: vis.statValueColor, fontSize: 20, fontWeight: FontWeight.w900)),
                                TextSpan(text: 'sellos', style: TextStyle(color: vis.subtleColor, fontSize: 12, fontWeight: FontWeight.w600)),
                              ])),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ] else
                    const SizedBox(height: 4),
                  Container(
                    margin: EdgeInsets.only(top: compact ? 8 : 0, left: -(compact ? 14.0 : 22.0), right: -(compact ? 14.0 : 22.0), bottom: -(compact ? 14.0 : 22.0)),
                    padding: EdgeInsets.symmetric(horizontal: compact ? 14 : 22, vertical: compact ? 8 : 16),
                    decoration: BoxDecoration(color: vis.footerBg, border: Border(top: BorderSide(color: vis.footerBorder))),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text('Fideli', style: TextStyle(color: vis.poweredByColor, fontSize: compact ? 9 : 11, fontWeight: FontWeight.w900)),
                        const Text('tap', style: TextStyle(color: Color(0xFF00C896), fontSize: 11, fontWeight: FontWeight.w900)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
