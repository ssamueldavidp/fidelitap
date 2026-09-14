import 'package:flutter/material.dart';
import 'app_colors.dart';

const _primary = Color(0xFF00C896);

ThemeData buildDarkTheme() => _buildTheme(Brightness.dark, AppColors.dark);
ThemeData buildLightTheme() => _buildTheme(Brightness.light, AppColors.light);

ThemeData _buildTheme(Brightness brightness, AppColors colors) {
  return ThemeData(
    brightness: brightness,
    scaffoldBackgroundColor: colors.bg,
    colorScheme: ColorScheme(
      brightness: brightness,
      primary: _primary,
      onPrimary: Colors.black,
      secondary: _primary,
      onSecondary: Colors.black,
      surface: colors.surface,
      onSurface: colors.textPrimary,
      error: const Color(0xFFEF4444),
      onError: Colors.white,
    ),
    extensions: [colors],
    appBarTheme: AppBarTheme(
      backgroundColor: colors.bg,
      foregroundColor: colors.textPrimary,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: _primary,
        foregroundColor: Colors.black,
        minimumSize: const Size(double.infinity, 52),
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: _primary,
        side: const BorderSide(color: _primary),
        minimumSize: const Size(double.infinity, 52),
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colors.surfaceAlt,
      labelStyle: TextStyle(color: colors.textSecondary),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _primary),
      ),
      hintStyle: TextStyle(color: colors.textMuted),
    ),
    textTheme: Typography.material2021(platform: TargetPlatform.iOS)
        .black
        .apply(bodyColor: colors.textPrimary, displayColor: colors.textPrimary),
    dividerColor: colors.divider,
    useMaterial3: true,
  );
}
