import 'package:flutter/material.dart';
import '../core/app_colors.dart';
import '../core/theme.dart';

/// Logo de Fidelitap (versión clara u oscura según el tema).
class FidelitapLogo extends StatelessWidget {
  const FidelitapLogo({super.key, this.height = 38});
  final double height;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Image.asset(
      dark ? 'assets/images/logo_dark.png' : 'assets/images/logo.png',
      height: height,
      fit: BoxFit.contain,
      semanticLabel: 'Fidelitap',
    );
  }
}

/// Estructura común de las pantallas de acceso: logo, botón de volver,
/// título grande y contenido sobre un fondo con círculos suaves.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    this.subtitle,
    required this.children,
    this.footer,
  });

  final String title;
  final String? subtitle;
  final List<Widget> children;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final canPop = Navigator.of(context).canPop();
    return Scaffold(
      body: Stack(children: [
        Positioned(
          right: -70,
          top: -70,
          child: Container(width: 240, height: 240, decoration: BoxDecoration(shape: BoxShape.circle, color: c.brandSoft)),
        ),
        Positioned(
          left: -90,
          top: 140,
          child: Container(width: 180, height: 180, decoration: BoxDecoration(shape: BoxShape.circle, color: c.brandSoft.withValues(alpha: 0.5))),
        ),
        SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
            children: [
              Row(children: [
                if (canPop)
                  Material(
                    color: c.surface,
                    shape: CircleBorder(side: BorderSide(color: c.border)),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () => Navigator.of(context).maybePop(),
                      child: SizedBox(width: 44, height: 44, child: Icon(Icons.arrow_back_rounded, color: c.textPrimary, size: 20)),
                    ),
                  ),
                const Spacer(),
                const FidelitapLogo(height: 34),
              ]),
              const SizedBox(height: 28),
              Text(title, style: displayStyle(size: 32, color: c.textPrimary, height: 1.1)),
              if (subtitle != null) ...[
                const SizedBox(height: 10),
                Text(subtitle!, style: TextStyle(fontSize: 16, color: c.textMuted, height: 1.4)),
              ],
              const SizedBox(height: 28),
              ...children,
              if (footer != null) ...[const SizedBox(height: 12), footer!],
            ],
          ),
        ),
      ]),
    );
  }
}

/// Mensaje de error de formulario.
class AuthError extends StatelessWidget {
  const AuthError(this.message, {super.key});
  final String message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: c.coralSoft, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        Icon(Icons.error_outline_rounded, color: c.coral, size: 20),
        const SizedBox(width: 10),
        Expanded(child: Text(message, style: TextStyle(color: c.coral, fontSize: 14, fontWeight: FontWeight.w600))),
      ]),
    );
  }
}
