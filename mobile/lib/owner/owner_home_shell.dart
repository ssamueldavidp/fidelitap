import 'package:flutter/material.dart';
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

  final _screens = const [
    DashboardScreen(),
    CardsScreen(),
    ScannerScreen(),
    CustomersScreen(),
    OwnerSettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _tab, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        backgroundColor: const Color(0xFF1E293B),
        indicatorColor: const Color(0xFF00C896).withValues(alpha: 0.15),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart, color: Color(0xFF00C896)),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.credit_card_outlined),
            selectedIcon: Icon(Icons.credit_card, color: Color(0xFF00C896)),
            label: 'Tarjetas',
          ),
          NavigationDestination(
            icon: Icon(Icons.qr_code_scanner_outlined),
            selectedIcon: Icon(Icons.qr_code_scanner, color: Color(0xFF00C896)),
            label: 'Scanner',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people, color: Color(0xFF00C896)),
            label: 'Clientes',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings, color: Color(0xFF00C896)),
            label: 'Ajustes',
          ),
        ],
      ),
    );
  }
}
