import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'auth/role_gate_screen.dart';
import 'auth/choose_screen.dart';
import 'auth/login_screen.dart';
import 'auth/claim_card_screen.dart';
import 'owner/owner_home_shell.dart';
import 'customer/customer_home_shell.dart';

// Global navigator key for push notification deep links
final navigatorKey = GlobalKey<NavigatorState>();

class FideliTapApp extends StatelessWidget {
  const FideliTapApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FideliTap',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      navigatorKey: navigatorKey,
      initialRoute: '/',
      routes: {
        '/': (_) => const RoleGateScreen(),
        '/auth/choose': (_) => const ChooseScreen(),
        '/auth/login': (_) => const LoginScreen(),
        '/auth/claim': (_) => const ClaimCardScreen(),
        '/owner': (_) => const OwnerHomeShell(),
        '/customer/cards': (_) => const CustomerHomeShell(),
      },
    );
  }
}
