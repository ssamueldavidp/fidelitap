import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../geofence/geofence_repository.dart';
import '../core/app_colors.dart';
import '../core/theme.dart';
import '../shared/ui.dart';
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
      body: SafeArea(
        bottom: false,
        child: _loading
            ? Center(child: CircularProgressIndicator(color: colors.brand))
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
                children: [
                  Text('Perfil', style: displayStyle(size: 28, color: colors.textPrimary)),
                  const SizedBox(height: 20),
                  SectionHeader('Apariencia'),
                  const SizedBox(height: 12),
                  ListenableBuilder(
                    listenable: themeController,
                    builder: (context, _) => AppCard(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      child: SwitchListTile(
                        value: themeController.isDark,
                        onChanged: (v) => themeController.setDark(v),
                        secondary: Icon(themeController.isDark ? Icons.dark_mode_outlined : Icons.light_mode_outlined, color: colors.textPrimary),
                        title: const Text('Tema oscuro', style: TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text(themeController.isDark ? 'Oscuro activado' : 'Claro activado'),
                        activeThumbColor: colors.brand,
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  SectionHeader('Notificaciones de proximidad'),
                  const SizedBox(height: 8),
                  Text(
                    'Te avisamos cuando estés cerca de un negocio y te falten sellos (negocios con plan Pro).',
                    style: TextStyle(color: colors.textMuted, fontSize: 13, height: 1.4),
                  ),
                  const SizedBox(height: 14),
                  if (_businesses.isEmpty)
                    AppCard(child: Text('No hay negocios Pro+ para configurar.', style: TextStyle(color: colors.textMuted)))
                  else
                    AppCard(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      child: Column(children: [
                        for (final b in _businesses)
                          SwitchListTile(
                            value: !_disabled.contains(b.businessId),
                            onChanged: (v) => _toggle(b.businessId, v),
                            title: Text(b.businessName, style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: const Text('Avisar al entrar en radio de 300m'),
                            activeThumbColor: colors.brand,
                          ),
                      ]),
                    ),
                  const SizedBox(height: 28),
                  SectionHeader('Cuenta'),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _logout,
                    icon: const Icon(Icons.logout_rounded, size: 18),
                    label: const Text('Cerrar sesión'),
                  ),
                ],
              ),
      ),
    );
  }
}
