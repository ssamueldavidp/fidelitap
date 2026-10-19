import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

ThemeData buildDarkTheme() => _buildTheme(Brightness.dark, AppColors.dark);
ThemeData buildLightTheme() => _buildTheme(Brightness.light, AppColors.light);

/// Títulos con Outfit (igual que la web); el resto del texto usa DM Sans.
TextStyle displayStyle({double size = 24, FontWeight weight = FontWeight.w700, Color? color, double? height}) =>
    GoogleFonts.outfit(fontSize: size, fontWeight: weight, color: color, letterSpacing: -size * 0.02, height: height);

ThemeData _buildTheme(Brightness brightness, AppColors colors) {
  final base = Typography.material2021(platform: TargetPlatform.iOS);
  final textTheme = GoogleFonts.dmSansTextTheme(brightness == Brightness.dark ? base.white : base.black)
      .apply(bodyColor: colors.textPrimary, displayColor: colors.textPrimary);
  final headings = textTheme.copyWith(
    displayLarge: GoogleFonts.outfit(textStyle: textTheme.displayLarge, fontWeight: FontWeight.w700),
    displayMedium: GoogleFonts.outfit(textStyle: textTheme.displayMedium, fontWeight: FontWeight.w700),
    displaySmall: GoogleFonts.outfit(textStyle: textTheme.displaySmall, fontWeight: FontWeight.w700),
    headlineLarge: GoogleFonts.outfit(textStyle: textTheme.headlineLarge, fontWeight: FontWeight.w700),
    headlineMedium: GoogleFonts.outfit(textStyle: textTheme.headlineMedium, fontWeight: FontWeight.w700),
    headlineSmall: GoogleFonts.outfit(textStyle: textTheme.headlineSmall, fontWeight: FontWeight.w700),
    titleLarge: GoogleFonts.outfit(textStyle: textTheme.titleLarge, fontWeight: FontWeight.w700),
  );

  const pill = StadiumBorder();

  return ThemeData(
    brightness: brightness,
    scaffoldBackgroundColor: colors.bg,
    colorScheme: ColorScheme(
      brightness: brightness,
      primary: colors.brand,
      onPrimary: colors.onBrand,
      secondary: colors.brand,
      onSecondary: colors.onBrand,
      surface: colors.surface,
      onSurface: colors.textPrimary,
      error: const Color(0xFFEF4444),
      onError: Colors.white,
    ),
    extensions: [colors],
    textTheme: headings,
    appBarTheme: AppBarTheme(
      backgroundColor: colors.bg,
      foregroundColor: colors.textPrimary,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: displayStyle(size: 22, color: colors.textPrimary),
    ),
    cardTheme: CardThemeData(
      color: colors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: const BorderRadius.all(Radius.circular(24)),
        side: BorderSide(color: colors.border),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: colors.brand,
        foregroundColor: colors.onBrand,
        elevation: 0,
        minimumSize: const Size(double.infinity, 54),
        shape: pill,
        textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w800, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.brand,
        side: BorderSide(color: colors.brand, width: 1.5),
        minimumSize: const Size(double.infinity, 54),
        shape: pill,
        textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w800, fontSize: 16),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: colors.brand, textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w700)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colors.surfaceAlt,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      labelStyle: TextStyle(color: colors.textSecondary),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: BorderSide(color: colors.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: BorderSide(color: colors.brand, width: 1.5)),
      hintStyle: TextStyle(color: colors.textMuted),
      prefixIconColor: colors.textMuted,
      suffixIconColor: colors.textMuted,
    ),
    chipTheme: ChipThemeData(shape: pill, side: BorderSide(color: colors.border)),
    dialogTheme: DialogThemeData(
      backgroundColor: colors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: colors.bg,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: colors.textPrimary,
      contentTextStyle: TextStyle(color: colors.bg, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    dividerColor: colors.divider,
    useMaterial3: true,
  );
}
