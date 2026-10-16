import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';
import '../core/app_colors.dart';
import '../core/theme.dart';
import '../shared/ui.dart';
import '../shared/wallet_preview_card.dart' show hexToColor;
import 'card_form_sheet.dart';
import 'poster_screen.dart';

class CardsScreen extends StatefulWidget {
  const CardsScreen({super.key});
  @override
  State<CardsScreen> createState() => _CardsScreenState();
}

class _CardsScreenState extends State<CardsScreen> {
  List<LoyaltyCardModel> _cards = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final cards = await MobileApiClient().getCards();
      setState(() { _cards = cards; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _openForm([LoyaltyCardModel? card]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.colors.bg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => CardFormSheet(existing: card, onSaved: _load),
    );
  }

  Future<void> _delete(LoyaltyCardModel card) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: context.colors.surface,
        title: Text('¿Eliminar tarjeta?', style: TextStyle(color: context.colors.textPrimary)),
        content: Text(
          'Se eliminará "${card.name}". Los clientes conservarán su historial.',
          style: TextStyle(color: context.colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Eliminar', style: TextStyle(color: Color(0xFFEF4444))),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await MobileApiClient().deleteCard(card.id);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        backgroundColor: c.brand,
        foregroundColor: c.onBrand,
        elevation: 6,
        shape: const StadiumBorder(),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nueva tarjeta', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: SafeArea(
        bottom: false,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 4),
            child: Row(children: [
              Expanded(child: Text('Mis tarjetas', style: displayStyle(size: 28, color: c.textPrimary))),
              IconButton(
                onPressed: _load,
                tooltip: 'Actualizar',
                icon: Icon(Icons.refresh_rounded, color: c.textPrimary),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text('Gestiona tus programas de fidelización', style: TextStyle(color: c.textMuted, fontSize: 14)),
          ),
          const SizedBox(height: 14),
          Expanded(child: _body(c)),
        ]),
      ),
    );
  }

  Widget _body(AppColors c) {
    if (_loading) return Center(child: CircularProgressIndicator(color: c.brand));
    if (_error != null) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('No se pudieron cargar las tarjetas', style: TextStyle(color: c.textMuted)),
          const SizedBox(height: 12),
          SizedBox(width: 180, child: ElevatedButton(onPressed: _load, child: const Text('Reintentar'))),
        ]),
      );
    }
    if (_cards.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(shape: BoxShape.circle, color: c.brandSoft),
              child: Icon(Icons.credit_card_rounded, size: 32, color: c.brand),
            ),
            const SizedBox(height: 16),
            Text('Aún no tienes tarjetas', style: displayStyle(size: 20, color: c.textPrimary)),
            const SizedBox(height: 6),
            Text('Crea tu primera tarjeta de fidelidad', style: TextStyle(color: c.textMuted)),
            const SizedBox(height: 20),
            SizedBox(width: 220, child: ElevatedButton(onPressed: () => _openForm(), child: const Text('Crear tarjeta'))),
          ]),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: c.brand,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 100),
        itemCount: _cards.length,
        separatorBuilder: (_, _) => const SizedBox(height: 16),
        itemBuilder: (_, i) => _CardTile(
          card: _cards[i],
          onEdit: () => _openForm(_cards[i]),
          onDelete: () => _delete(_cards[i]),
          onPoster: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => PosterScreen(cardId: _cards[i].id, cardName: _cards[i].name),
          )),
        ),
      ),
    );
  }
}

class _CardTile extends StatelessWidget {
  final LoyaltyCardModel card;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onPoster;
  const _CardTile({required this.card, required this.onEdit, required this.onDelete, required this.onPoster});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final accent = hexToColor(card.color);
    final darker = Color.lerp(accent, Colors.black, 0.35)!;
    final total = card.stampsRequired.clamp(1, 12);
    final filled = (total * 0.6).round();
    final expires = card.expiresAt != null ? DateTime.tryParse(card.expiresAt!) : null;
    final daysLeft = expires?.difference(DateTime.now()).inDays;
    final isUrgent = daysLeft != null && daysLeft <= 7;

    return AppCard(
      padding: EdgeInsets.zero,
      radius: 28,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            padding: const EdgeInsets.fromLTRB(18, 16, 8, 16),
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [accent, darker]),
            ),
            child: Stack(children: [
              Positioned(right: 20, top: -34, child: Container(width: 120, height: 120, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.13)))),
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.9), borderRadius: BorderRadius.circular(15)),
                    child: Text(card.stampIcon, style: const TextStyle(fontSize: 22)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(card.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: displayStyle(size: 20, color: Colors.white)),
                  ),
                  PopupMenuButton<String>(
                    color: colors.surface,
                    onSelected: (v) {
                      if (v == 'edit') {
                        onEdit();
                      } else if (v == 'poster') {
                        onPoster();
                      } else {
                        onDelete();
                      }
                    },
                    itemBuilder: (ctx) => [
                      PopupMenuItem(
                        value: 'edit',
                        child: Row(children: [
                          Icon(Icons.edit_outlined, size: 18, color: ctx.colors.textPrimary),
                          const SizedBox(width: 8),
                          Text('Editar', style: TextStyle(color: ctx.colors.textPrimary)),
                        ]),
                      ),
                      PopupMenuItem(
                        value: 'poster',
                        child: Row(children: [
                          Icon(Icons.image_outlined, size: 18, color: ctx.colors.textPrimary),
                          const SizedBox(width: 8),
                          Text('Plantilla / Cartel', style: TextStyle(color: ctx.colors.textPrimary)),
                        ]),
                      ),
                      const PopupMenuItem(
                        value: 'delete',
                        child: Row(children: [
                          Icon(Icons.delete_outline, size: 18, color: Color(0xFFEF4444)),
                          SizedBox(width: 8),
                          Text('Eliminar', style: TextStyle(color: Color(0xFFEF4444))),
                        ]),
                      ),
                    ],
                    icon: const Icon(Icons.more_vert_rounded, color: Colors.white),
                  ),
                ]),
                const SizedBox(height: 14),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  for (var i = 0; i < total; i++)
                    Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i < filled ? Colors.white : Colors.transparent,
                        border: Border.all(color: Colors.white.withValues(alpha: 0.75), width: 2),
                      ),
                    ),
                ]),
              ]),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 16),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${card.stampsRequired} sellos = ${card.benefitDescription}',
                      maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 14)),
                  if (expires != null) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isUrgent ? colors.coralSoft : colors.surfaceAlt,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        isUrgent ? 'Vence en $daysLeft ${daysLeft == 1 ? 'día' : 'días'}' : 'Vence ${expires.day}/${expires.month}/${expires.year}',
                        style: TextStyle(fontSize: 11, color: isUrgent ? colors.coral : colors.textMuted, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ]),
              ),
              if (!card.isActive)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: colors.surfaceAlt, borderRadius: BorderRadius.circular(999)),
                  child: Text('Inactiva', style: TextStyle(fontSize: 11, color: colors.textMuted, fontWeight: FontWeight.w700)),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}
