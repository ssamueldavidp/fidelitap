import 'package:flutter/material.dart';

/// Tokens de color de Fidelitap (claro y oscuro). Reflejan la paleta de la web
/// (`globals.css`): superficies suaves, verde de marca y acentos cálidos.
/// Se accede con `context.colors.X`.
class AppColors extends ThemeExtension<AppColors> {
  final Color bg;
  final Color surface;
  final Color surfaceAlt;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color border;
  final Color divider;

  /// Verde de marca y su fondo suave.
  final Color brand;
  final Color brandSoft;
  final Color onBrand;

  /// Acentos para indicadores, cada uno con su fondo suave.
  final Color sky;
  final Color skySoft;
  final Color sun;
  final Color sunSoft;
  final Color lilac;
  final Color lilacSoft;
  final Color coral;
  final Color coralSoft;

  /// Sombra de las tarjetas.
  final List<BoxShadow> shadow;

  const AppColors({
    required this.bg,
    required this.surface,
    required this.surfaceAlt,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.border,
    required this.divider,
    required this.brand,
    required this.brandSoft,
    required this.onBrand,
    required this.sky,
    required this.skySoft,
    required this.sun,
    required this.sunSoft,
    required this.lilac,
    required this.lilacSoft,
    required this.coral,
    required this.coralSoft,
    required this.shadow,
  });

  static const dark = AppColors(
    bg: Color(0xFF0F0F10),
    surface: Color(0xFF1A1A1C),
    surfaceAlt: Color(0xFF252528),
    textPrimary: Color(0xFFF4F4F5),
    textSecondary: Color(0xFFD0D0D6),
    textMuted: Color(0xFFB4B4BB),
    border: Color(0x1FFFFFFF),
    divider: Color(0x1FFFFFFF),
    brand: Color(0xFF34D399),
    brandSoft: Color(0x2434D399),
    onBrand: Color(0xFF05281A),
    sky: Color(0xFF6EA8FF),
    skySoft: Color(0x246EA8FF),
    sun: Color(0xFFFFC24D),
    sunSoft: Color(0x24FFC24D),
    lilac: Color(0xFFA592FF),
    lilacSoft: Color(0x29A592FF),
    coral: Color(0xFFFF8F63),
    coralSoft: Color(0x24FF8F63),
    shadow: [BoxShadow(color: Color(0x73000000), blurRadius: 30, offset: Offset(0, 14))],
  );

  static const light = AppColors(
    bg: Color(0xFFF4F6FA),
    surface: Colors.white,
    surfaceAlt: Color(0xFFF1F4F9),
    textPrimary: Color(0xFF12161C),
    textSecondary: Color(0xFF3F4958),
    textMuted: Color(0xFF5B6676),
    border: Color(0x14121620),
    divider: Color(0x14121620),
    brand: Color(0xFF0A8F52),
    brandSoft: Color(0xFFE3F6EC),
    onBrand: Colors.white,
    sky: Color(0xFF2563EB),
    skySoft: Color(0xFFE4EEFF),
    sun: Color(0xFFB7791F),
    sunSoft: Color(0xFFFFF3D6),
    lilac: Color(0xFF6D4AE8),
    lilacSoft: Color(0xFFECE7FF),
    coral: Color(0xFFE2552B),
    coralSoft: Color(0xFFFFEDE4),
    shadow: [BoxShadow(color: Color(0x12121620), blurRadius: 28, offset: Offset(0, 12))],
  );

  @override
  AppColors copyWith() => this;

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return AppColors(
      bg: l(bg, other.bg),
      surface: l(surface, other.surface),
      surfaceAlt: l(surfaceAlt, other.surfaceAlt),
      textPrimary: l(textPrimary, other.textPrimary),
      textSecondary: l(textSecondary, other.textSecondary),
      textMuted: l(textMuted, other.textMuted),
      border: l(border, other.border),
      divider: l(divider, other.divider),
      brand: l(brand, other.brand),
      brandSoft: l(brandSoft, other.brandSoft),
      onBrand: l(onBrand, other.onBrand),
      sky: l(sky, other.sky),
      skySoft: l(skySoft, other.skySoft),
      sun: l(sun, other.sun),
      sunSoft: l(sunSoft, other.sunSoft),
      lilac: l(lilac, other.lilac),
      lilacSoft: l(lilacSoft, other.lilacSoft),
      coral: l(coral, other.coral),
      coralSoft: l(coralSoft, other.coralSoft),
      shadow: t < 0.5 ? shadow : other.shadow,
    );
  }
}

extension AppColorsX on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>() ?? AppColors.light;
}
