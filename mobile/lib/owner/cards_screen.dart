import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';
import 'card_form_sheet.dart';

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
      backgroundColor: const Color(0xFF0F172A),
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
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('¿Eliminar tarjeta?', style: TextStyle(color: Colors.white)),
        content: Text(
          'Se eliminará "${card.name}". Los clientes conservarán su historial.',
          style: const TextStyle(color: Color(0xFF94A3B8)),
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis tarjetas'),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh))],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        backgroundColor: const Color(0xFF00C896),
        foregroundColor: Colors.black,
        icon: const Icon(Icons.add),
        label: const Text('Nueva tarjeta', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C896)))
          : _error != null
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text('Error: $_error',
                        style: const TextStyle(color: Color(0xFF94A3B8))),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _load,
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFF00C896)),
                      child: const Text('Reintentar', style: TextStyle(color: Colors.black)),
                    ),
                  ]),
                )
              : _cards.isEmpty
                  ? Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Text('🎴', style: TextStyle(fontSize: 48)),
                        const SizedBox(height: 12),
                        const Text('Aún no tienes tarjetas',
                            style: TextStyle(color: Colors.white, fontSize: 16)),
                        const SizedBox(height: 8),
                        const Text('Crea tu primera tarjeta de fidelidad',
                            style: TextStyle(color: Color(0xFF94A3B8))),
                        const SizedBox(height: 20),
                        FilledButton.icon(
                          onPressed: () => _openForm(),
                          icon: const Icon(Icons.add),
                          label: const Text('Crear tarjeta'),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF00C896),
                            foregroundColor: Colors.black,
                          ),
                        ),
                      ]),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: const Color(0xFF00C896),
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                        itemCount: _cards.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (_, i) => _CardTile(
                          card: _cards[i],
                          onEdit: () => _openForm(_cards[i]),
                          onDelete: () => _delete(_cards[i]),
                        ),
                      ),
                    ),
    );
  }
}

class _CardTile extends StatelessWidget {
  final LoyaltyCardModel card;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _CardTile({required this.card, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(children: [
        Text(card.stampIcon, style: const TextStyle(fontSize: 32)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              card.name,
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
            ),
            const SizedBox(height: 4),
            Text(
              '${card.stampsRequired} sellos · ${card.benefitDescription}',
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
            ),
            if (card.expiresAt != null) ...[
              const SizedBox(height: 4),
              Builder(builder: (_) {
                final expires = DateTime.tryParse(card.expiresAt!);
                if (expires == null) return const SizedBox.shrink();
                final daysLeft = expires.difference(DateTime.now()).inDays;
                final isUrgent = daysLeft <= 7;
                return Row(children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: isUrgent
                          ? const Color(0xFFEF4444).withValues(alpha: 0.15)
                          : Colors.white.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      isUrgent
                          ? '⚠️ Vence en $daysLeft días'
                          : '📅 Vence ${expires.day}/${expires.month}/${expires.year}',
                      style: TextStyle(
                        fontSize: 10,
                        color: isUrgent ? const Color(0xFFEF4444) : Colors.white38,
                        fontWeight: isUrgent ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                  ),
                ]);
              }),
            ],
          ]),
        ),
        PopupMenuButton<String>(
          color: const Color(0xFF1E293B),
          onSelected: (v) => v == 'edit' ? onEdit() : onDelete(),
          itemBuilder: (_) => const [
            PopupMenuItem(
              value: 'edit',
              child: Row(children: [
                Icon(Icons.edit_outlined, size: 18, color: Colors.white),
                SizedBox(width: 8),
                Text('Editar', style: TextStyle(color: Colors.white)),
              ]),
            ),
            PopupMenuItem(
              value: 'delete',
              child: Row(children: [
                Icon(Icons.delete_outline, size: 18, color: Color(0xFFEF4444)),
                SizedBox(width: 8),
                Text('Eliminar', style: TextStyle(color: Color(0xFFEF4444))),
              ]),
            ),
          ],
          icon: const Icon(Icons.more_vert, color: Color(0xFF64748B)),
        ),
      ]),
    );
  }
}
