import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists the user's dark/light choice (Settings → Apariencia) across
/// launches, mirroring the web dashboard's own theme toggle.
class ThemeController extends ChangeNotifier {
  static const _prefKey = 'theme_mode';
  ThemeMode _mode = ThemeMode.dark;
  ThemeMode get mode => _mode;
  bool get isDark => _mode == ThemeMode.dark;

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_prefKey);
      _mode = saved == 'light' ? ThemeMode.light : ThemeMode.dark;
      notifyListeners();
    } catch (_) {
      // Local storage unavailable — keep the dark default.
    }
  }

  Future<void> setDark(bool dark) async {
    _mode = dark ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefKey, dark ? 'dark' : 'light');
    } catch (_) {
      // Best-effort persistence only.
    }
  }
}

final themeController = ThemeController();
