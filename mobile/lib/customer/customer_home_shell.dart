import 'package:flutter/material.dart';
import 'card_list_screen.dart';
import 'stores_screen.dart';
import 'settings_screen.dart';
import '../geofence/geofence_manager.dart';
import '../core/app_colors.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _tab, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        backgroundColor: context.colors.surface,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.credit_card_outlined),
            selectedIcon: Icon(Icons.credit_card),
            label: 'Mis tarjetas',
          ),
          NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront),
            label: 'Tiendas',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Ajustes',
          ),
        ],
      ),
    );
  }
}
