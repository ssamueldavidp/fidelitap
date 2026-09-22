import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../geofence/geofence_repository.dart';
import '../core/app_colors.dart';
import '../core/theme_controller.dart';
import '../core/supabase_client.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  List<BusinessGeoInfo> _businesses = [];
  Set<String> _disabled = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final prefs = await SharedPreferences.getInstance();
    final disabledList = prefs.getStringList('disabled_geofences') ?? [];
    final businesses = await GeofenceRepository().fetchEligibleBusinesses();
    setState(() {
      _businesses = businesses;
      _disabled = disabledList.toSet();
      _loading = false;
    });
  }

  Future<void> _toggle(String businessId, bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      if (enabled) {
        _disabled.remove(businessId);
      } else {
        _disabled.add(businessId);
      }
    });
    await prefs.setStringList('disabled_geofences', _disabled.toList());
  }

  Future<void> _logout() async {
    await supabase.auth.signOut();
    if (mounted) Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('Ajustes')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C896)))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text('Apariencia',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: colors.textPrimary)),
                const SizedBox(height: 8),
                ListenableBuilder(
                  listenable: themeController,
                  builder: (context, _) => SwitchListTile(
                    value: themeController.isDark,
                    onChanged: (v) => themeController.setDark(v),
                    contentPadding: EdgeInsets.zero,
                    secondary: Icon(themeController.isDark ? Icons.dark_mode_outlined : Icons.light_mode_outlined),
                    title: const Text('Tema oscuro'),
                    subtitle: Text(themeController.isDark ? 'Oscuro activado' : 'Claro activado'),
                    activeThumbColor: const Color(0xFF00C896),
                  ),
                ),
                const SizedBox(height: 24),
                Text('Notificaciones de proximidad',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: colors.textPrimary)),
                const SizedBox(height: 8),
                Text(
                  'Te avisamos cuando estés cerca de un negocio y te falten sellos (negocios con plan Pro).',
                  style: TextStyle(color: colors.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 16),
                if (_businesses.isEmpty)
                  Text('No hay negocios Pro+ para configurar.',
                      style: TextStyle(color: colors.textMuted)),
                ..._businesses.map((b) => SwitchListTile(
                      value: !_disabled.contains(b.businessId),
                      onChanged: (v) => _toggle(b.businessId, v),
                      title: Text(b.businessName),
                      subtitle: const Text('Avisar al entrar en radio de 300m'),
                      activeThumbColor: const Color(0xFF00C896),
                    )),
                const SizedBox(height: 32),
                Text('Cuenta', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: colors.textPrimary)),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _logout,
                    icon: const Icon(Icons.logout, size: 18),
                    label: const Text('Cerrar sesión'),
                  ),
                ),
              ],
            ),
    );
  }
}
