import 'package:flutter/material.dart';
import '../core/app_colors.dart';
import '../core/theme.dart';

/// Tarjeta base del rediseño: superficie, borde suave y sombra.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.radius = 24,
    this.onTap,
    this.color,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final box = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? c.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: c.border),
        boxShadow: c.shadow,
      ),
      child: child,
    );
    if (onTap == null) return box;
    return Material(
      color: Colors.transparent,
      child: InkWell(borderRadius: BorderRadius.circular(radius), onTap: onTap, child: box),
    );
  }
}

/// Bloque con degradado verde y círculos decorativos (tarjeta "Hoy", banners).
class GradientHero extends StatelessWidget {
  const GradientHero({
    super.key,
    required this.child,
    this.colors = const [Color(0xFF0FB36A), Color(0xFF087A47), Color(0xFF055B35)],
    this.padding = const EdgeInsets.all(22),
    this.radius = 28,
  });

  final Widget child;
  final List<Color> colors;
  final EdgeInsetsGeometry padding;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: colors),
        boxShadow: [BoxShadow(color: colors[1].withValues(alpha: 0.38), blurRadius: 36, offset: const Offset(0, 18))],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Stack(children: [
          Positioned(right: -40, top: -40, child: _circle(170, 0.10)),
          Positioned(right: 30, bottom: -70, child: _circle(140, 0.08)),
          Padding(padding: padding, child: child),
        ]),
      ),
    );
  }

  static Widget _circle(double size, double alpha) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: alpha)),
      );
}

/// Título de sección con acción opcional ("Ver todo").
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: displayStyle(size: 20, color: c.textPrimary)),
        if (action != null)
          GestureDetector(
            onTap: onAction,
            child: Text(action!, style: TextStyle(color: c.brand, fontWeight: FontWeight.w700, fontSize: 14)),
          ),
      ],
    );
  }
}

/// Círculo con la inicial de una persona o negocio.
class InitialAvatar extends StatelessWidget {
  const InitialAvatar(this.initial, {super.key, required this.background, required this.foreground, this.size = 42});
  final String initial;
  final Color background;
  final Color foreground;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(shape: BoxShape.circle, color: background),
        child: Text(initial.isEmpty ? '?' : initial.characters.first.toUpperCase(),
            style: displayStyle(size: size * 0.42, color: foreground)),
      );
}

class NavItem {
  const NavItem({required this.icon, required this.activeIcon, required this.label});
  final IconData icon;
  final IconData activeIcon;
  final String label;
}

/// Barra de navegación inferior flotante, con botón central opcional
/// (escáner). `centerIndex` es la posición del botón central en [items].
class FloatingNavBar extends StatelessWidget {
  const FloatingNavBar({
    super.key,
    required this.items,
    required this.index,
    required this.onChanged,
    this.centerIndex,
    this.centerIcon = Icons.qr_code_scanner_rounded,
  });

  final List<NavItem> items;
  final int index;
  final ValueChanged<int> onChanged;
  final int? centerIndex;
  final IconData centerIcon;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final bottom = MediaQuery.of(context).padding.bottom;
    final hasCenter = centerIndex != null;
    return SizedBox(
      height: (hasCenter ? 96 : 84) + bottom * 0.6,
      child: Stack(
        alignment: Alignment.bottomCenter,
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: 16,
            right: 16,
            bottom: 14 + bottom * 0.6,
            child: Container(
              height: 70,
              decoration: BoxDecoration(
                color: c.surface,
                borderRadius: BorderRadius.circular(35),
                border: Border.all(color: c.border),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.16), blurRadius: 36, offset: const Offset(0, 16))],
              ),
              child: Row(
                children: [
                  for (var i = 0; i < items.length; i++)
                    Expanded(
                      child: i == centerIndex
                          ? const SizedBox()
                          : _Tab(item: items[i], selected: i == index, onTap: () => onChanged(i)),
                    ),
                ],
              ),
            ),
          ),
          if (hasCenter)
            Positioned(
              bottom: 14 + bottom * 0.6 + 22,
              child: Semantics(
                button: true,
                label: items[centerIndex!].label,
                child: GestureDetector(
                  onTap: () => onChanged(centerIndex!),
                  child: Container(
                    width: 66,
                    height: 66,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFF12C06F), Color(0xFF087A47)],
                      ),
                      border: Border.all(color: c.bg, width: 5),
                      boxShadow: [BoxShadow(color: const Color(0xFF0A9F5B).withValues(alpha: 0.45), blurRadius: 24, offset: const Offset(0, 12))],
                    ),
                    child: Icon(centerIcon, color: Colors.white, size: 28),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.item, required this.selected, required this.onTap});
  final NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final color = selected ? c.brand : c.textMuted;
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: InkWell(
        borderRadius: BorderRadius.circular(35),
        onTap: onTap,
        child: Center(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            decoration: BoxDecoration(
              color: selected ? c.brandSoft : Colors.transparent,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(selected ? item.activeIcon : item.icon, color: color, size: 24),
                const SizedBox(height: 1),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(item.label, style: TextStyle(color: color, fontSize: 11, height: 1.2, fontWeight: selected ? FontWeight.w800 : FontWeight.w700)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
