import 'package:flutter/material.dart';
import '../shared/ui.dart';
import 'dashboard_screen.dart';
import 'scanner_screen.dart';
import 'cards_screen.dart';
import 'customers_screen.dart';
import 'owner_settings_screen.dart';

class OwnerHomeShell extends StatefulWidget {
  const OwnerHomeShell({super.key});

  @override
  State<OwnerHomeShell> createState() => _OwnerHomeShellState();
}

class _OwnerHomeShellState extends State<OwnerHomeShell> {
  int _tab = 0;

  late final _screens = [
    DashboardScreen(onOpenTab: (i) => setState(() => _tab = i)),
    const CardsScreen(),
    const ScannerScreen(),
    const CustomersScreen(),
    const OwnerSettingsScreen(),
  ];

  static const _items = [
    NavItem(icon: Icons.home_outlined, activeIcon: Icons.home_rounded, label: 'Inicio'),
    NavItem(icon: Icons.credit_card_outlined, activeIcon: Icons.credit_card_rounded, label: 'Tarjetas'),
    NavItem(icon: Icons.qr_code_scanner_outlined, activeIcon: Icons.qr_code_scanner_rounded, label: 'Escanear'),
    NavItem(icon: Icons.people_outline_rounded, activeIcon: Icons.people_rounded, label: 'Clientes'),
    NavItem(icon: Icons.settings_outlined, activeIcon: Icons.settings_rounded, label: 'Ajustes'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _tab, children: _screens),
      bottomNavigationBar: FloatingNavBar(
        items: _items,
        index: _tab,
        centerIndex: 2,
        onChanged: (i) => setState(() => _tab = i),
      ),
    );
  }
}
