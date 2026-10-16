import 'package:flutter/material.dart';
import 'card_list_screen.dart';
import 'stores_screen.dart';
import 'settings_screen.dart';
import '../geofence/geofence_manager.dart';
import '../shared/ui.dart';

class CustomerHomeShell extends StatefulWidget {
  const CustomerHomeShell({super.key});

  @override
  State<CustomerHomeShell> createState() => _CustomerHomeShellState();
}

class _CustomerHomeShellState extends State<CustomerHomeShell> {
  int _tab = 0;
  final _geoManager = GeofenceManager();

  @override
  void initState() {
    super.initState();
    _geoManager.startIfEligible();
  }

  @override
  void dispose() {
    _geoManager.stop();
    super.dispose();
  }

  final _screens = const [CardListScreen(), StoresScreen(), SettingsScreen()];

  static const _items = [
    NavItem(icon: Icons.credit_card_outlined, activeIcon: Icons.credit_card_rounded, label: 'Tarjetas'),
    NavItem(icon: Icons.location_on_outlined, activeIcon: Icons.location_on_rounded, label: 'Tiendas'),
    NavItem(icon: Icons.person_outline_rounded, activeIcon: Icons.person_rounded, label: 'Perfil'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _tab, children: _screens),
      bottomNavigationBar: FloatingNavBar(
        items: _items,
        index: _tab,
        onChanged: (i) => setState(() => _tab = i),
      ),
    );
  }
}
