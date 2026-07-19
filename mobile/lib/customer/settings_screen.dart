import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../geofence/geofence_repository.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ajustes')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C896)))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text('Notificaciones de proximidad',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                const Text(
                  'Te avisamos cuando estés cerca de un negocio y te falten sellos (negocios con plan Pro).',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                ),
                const SizedBox(height: 16),
                if (_businesses.isEmpty)
                  const Text('No hay negocios Pro+ para configurar.',
                      style: TextStyle(color: Color(0xFF64748B))),
                ..._businesses.map((b) => SwitchListTile(
                      value: !_disabled.contains(b.businessId),
                      onChanged: (v) => _toggle(b.businessId, v),
                      title: Text(b.businessName),
                      subtitle: const Text('Avisar al entrar en radio de 300m'),
                      activeThumbColor: const Color(0xFF00C896),
                    )),
              ],
            ),
    );
  }
}
