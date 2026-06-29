import 'package:flutter/material.dart';
import '../core/session_role.dart';
import '../push/push_service.dart';

class RoleGateScreen extends StatefulWidget {
  const RoleGateScreen({super.key});

  @override
  State<RoleGateScreen> createState() => _RoleGateScreenState();
}

class _RoleGateScreenState extends State<RoleGateScreen> {
  @override
  void initState() {
    super.initState();
    _resolve();
  }

  Future<void> _resolve() async {
    final role = await resolveRole();
    if (!mounted) return;
    if (role == AppRole.owner) {
      await initPush();
      if (mounted) Navigator.of(context).pushReplacementNamed('/owner');
    } else if (role == AppRole.customer) {
      await initPush();
      if (mounted) Navigator.of(context).pushReplacementNamed('/customer/cards');
    } else {
      if (mounted) Navigator.of(context).pushReplacementNamed('/auth/choose');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.loyalty, size: 80, color: Color(0xFF00C896)),
            const SizedBox(height: 24),
            const CircularProgressIndicator(color: Color(0xFF00C896)),
          ],
        ),
      ),
    );
  }
}
