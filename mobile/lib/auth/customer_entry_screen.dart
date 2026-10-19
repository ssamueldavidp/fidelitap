import 'package:flutter/material.dart';
import '../core/app_colors.dart';
import '../core/theme.dart';
import '../shared/auth_ui.dart';
import '../shared/ui.dart';
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
    final c = context.colors;
    return AuthScaffold(
      title: '¿Tienes un código o QR de una tarjeta?',
      subtitle: 'Si un negocio ya te dio su QR, escanéalo para activar tu tarjeta. Si no, crea tu cuenta y agrega una más adelante.',
      children: [
        _OptionTile(
          icon: Icons.qr_code_scanner_rounded,
          tone: c.brand,
          soft: c.brandSoft,
          title: 'Sí, escanearlo',
          subtitle: 'Activa tu tarjeta con el QR del negocio',
          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ClaimCardScreen())),
        ),
        const SizedBox(height: 14),
        _OptionTile(
          icon: Icons.person_add_alt_1_rounded,
          tone: c.lilac,
          soft: c.lilacSoft,
          title: 'No, quiero registrarme',
          subtitle: 'Crea tu cuenta y explora tiendas cercanas',
          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CustomerRegisterScreen())),
        ),
        const SizedBox(height: 18),
        Center(
          child: TextButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RecoverAccountScreen())),
            child: const Text('Ya tengo cuenta — recuperar mis tarjetas'),
          ),
        ),
      ],
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({required this.icon, required this.tone, required this.soft, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final Color tone;
  final Color soft;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      onTap: onTap,
      radius: 26,
      padding: const EdgeInsets.all(18),
      child: Row(children: [
        Container(
          width: 54,
          height: 54,
          decoration: BoxDecoration(color: soft, borderRadius: BorderRadius.circular(18)),
          child: Icon(icon, color: tone, size: 28),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: displayStyle(size: 18, color: c.textPrimary)),
            const SizedBox(height: 3),
            Text(subtitle, style: TextStyle(fontSize: 13, color: c.textMuted, height: 1.3)),
          ]),
        ),
        Icon(Icons.chevron_right_rounded, color: c.textMuted),
      ]),
    );
  }
}
