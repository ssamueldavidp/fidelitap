import 'package:flutter/material.dart';
import '../core/app_colors.dart';
import 'claim_card_screen.dart';
import 'customer_register_screen.dart';
import 'recover_account_screen.dart';

/// The branch point for a regular user: do they already have a QR/code from
/// a business, or are they just creating an account to browse Tiendas /
/// join a card later? Splitting this out (rather than sending everyone
/// straight into ClaimCardScreen's camera) is what lets someone register
/// with no card at all.
class CustomerEntryScreen extends StatelessWidget {
  const CustomerEntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('Soy cliente')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.qr_code_scanner,
                size: 56,
                color: Color(0xFF0A9F5B),
              ),
              const SizedBox(height: 20),
              Text(
                '¿Tienes un código o QR de una tarjeta de fidelización?',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: colors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Si un negocio ya te dio su QR, escanéalo para activar tu tarjeta. Si no, puedes crear tu cuenta y agregar una tarjeta más adelante.',
                style: TextStyle(fontSize: 14, color: colors.textSecondary),
              ),
              const SizedBox(height: 32),
              ElevatedButton.icon(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ClaimCardScreen()),
                ),
                icon: const Icon(Icons.qr_code),
                label: const Text('Sí, escanearlo'),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const CustomerRegisterScreen(),
                  ),
                ),
                icon: const Icon(Icons.person_add_alt),
                label: const Text('No, quiero registrarme'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const RecoverAccountScreen(),
                  ),
                ),
                child: const Text('Ya tengo cuenta — recuperar mis tarjetas'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
