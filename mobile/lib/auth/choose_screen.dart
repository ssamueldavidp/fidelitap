import 'package:flutter/material.dart';
import '../core/app_colors.dart';
import '../core/theme.dart';

/// Pantalla de bienvenida: ilustración con tarjetas de sellos y los dos accesos.
class ChooseScreen extends StatelessWidget {
  const ChooseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      body: Column(children: [
        // Zona superior con degradado y tarjetas de sellos
        Expanded(
          flex: 11,
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(40)),
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF0FB36A), Color(0xFF087A47), Color(0xFF055B35)],
                ),
              ),
              child: Stack(children: [
                Positioned(right: -60, top: -60, child: _Circle(240, 0.10)),
                Positioned(left: -80, bottom: -90, child: _Circle(260, 0.08)),
                SafeArea(
                  child: Column(children: [
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
                      child: Image.asset('assets/images/logo.png', height: 30, semanticLabel: 'Fidelitap'),
                    ),
                    const Expanded(child: _CardStack()),
                  ]),
                ),
              ]),
            ),
          ),
        ),
        // Texto y botones
        Expanded(
          flex: 9,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(28, 28, 28, 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Tu tarjeta de fidelidad, siempre contigo',
                    style: displayStyle(size: 28, color: c.textPrimary, height: 1.12)),
                const SizedBox(height: 10),
                Text('Junta sellos en tus negocios favoritos y reclama premios.',
                    style: TextStyle(fontSize: 16, color: c.textMuted, height: 1.35)),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: () => Navigator.of(context).pushNamed('/auth/customer'),
                  icon: const Icon(Icons.person_outline_rounded),
                  label: const Text('Soy cliente'),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).pushNamed('/auth/login'),
                  icon: const Icon(Icons.storefront_outlined),
                  label: const Text('Soy dueño de un negocio'),
                ),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

class _Circle extends StatelessWidget {
  const _Circle(this.size, this.alpha);
  final double size;
  final double alpha;

  @override
  Widget build(BuildContext context) =>
      Container(width: size, height: size, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: alpha)));
}

/// Tres tarjetas apiladas e inclinadas, con sellos.
class _CardStack extends StatelessWidget {
  const _CardStack();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, box) {
      final w = (box.maxWidth * 0.64).clamp(180.0, 260.0);
      return Center(
        child: SizedBox(
          width: w + 60,
          height: w * 1.0 + 30,
          child: Stack(alignment: Alignment.center, children: [
            Transform.translate(
              offset: const Offset(-24, -52),
              child: Transform.rotate(angle: -0.12, child: _MiniCard(width: w, icon: '🥐', name: 'Pan de Casa', filled: 3, total: 6, colors: const [Color(0xFFFF8A5B), Color(0xFFE8452C)])),
            ),
            Transform.translate(
              offset: const Offset(18, -8),
              child: Transform.rotate(angle: 0.08, child: _MiniCard(width: w, icon: '💈', name: 'Barbería 21', filled: 5, total: 8, colors: const [Color(0xFF6D4AE8), Color(0xFF4527B8)])),
            ),
            Transform.translate(
              offset: const Offset(-4, 50),
              child: _MiniCard(width: w, icon: '☕', name: 'Café Luna', filled: 6, total: 8, colors: const [Color(0xFFFFFFFF), Color(0xFFE9F7F0)], dark: false),
            ),
          ]),
        ),
      );
    });
  }
}

class _MiniCard extends StatelessWidget {
  const _MiniCard({required this.width, required this.icon, required this.name, required this.filled, required this.total, required this.colors, this.dark = true});
  final double width;
  final String icon;
  final String name;
  final int filled;
  final int total;
  final List<Color> colors;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final fg = dark ? Colors.white : const Color(0xFF12161C);
    final accent = dark ? Colors.white : const Color(0xFF0A9F5B);
    return Container(
      width: width,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: colors),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.28), blurRadius: 28, offset: const Offset(0, 14))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: dark ? Colors.white.withValues(alpha: 0.9) : const Color(0xFFE3F6EC), borderRadius: BorderRadius.circular(12)),
            child: Text(icon, style: const TextStyle(fontSize: 18)),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: displayStyle(size: 16, color: fg))),
        ]),
        const SizedBox(height: 14),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (var i = 0; i < total; i++)
            Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: i < filled ? accent : Colors.transparent,
                border: Border.all(color: accent.withValues(alpha: 0.7), width: 2),
              ),
            ),
        ]),
      ]),
    );
  }
}
