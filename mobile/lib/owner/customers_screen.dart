import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';
import '../core/app_colors.dart';
import '../core/theme.dart';
import '../shared/ui.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});
  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  List<CustomerModel> _all = [];
  List<CustomerModel> _filtered = [];
  List<LoyaltyCardModel> _cards = [];
  String? _selectedCardId;
  bool _loading = true;
  String? _error;
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _search.addListener(_filter);
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        MobileApiClient().getCustomers(cardId: _selectedCardId),
        MobileApiClient().getCards(),
      ]);
      setState(() {
        _all = results[0] as List<CustomerModel>;
        _cards = results[1] as List<LoyaltyCardModel>;
        _loading = false;
      });
      _filter();
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _filter() {
    final q = _search.text.toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? List.of(_all)
          : _all.where((c) => c.customerName.toLowerCase().contains(q)).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 4),
            child: Row(children: [
              Expanded(child: Text('Clientes', style: displayStyle(size: 28, color: colors.textPrimary))),
              IconButton(onPressed: _load, tooltip: 'Actualizar', icon: Icon(Icons.refresh_rounded, color: colors.textPrimary)),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Container(
              height: 52,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(26),
                border: Border.all(color: colors.border),
                boxShadow: colors.shadow,
              ),
              child: Row(children: [
                Icon(Icons.search_rounded, color: colors.textMuted),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _search,
                    style: TextStyle(color: colors.textPrimary, fontSize: 15),
                    decoration: InputDecoration(
                      hintText: 'Buscar cliente',
                      hintStyle: TextStyle(color: colors.textMuted),
                      filled: false,
                      isCollapsed: true,
                      contentPadding: EdgeInsets.zero,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                    ),
                  ),
                ),
              ]),
            ),
          ),
          if (_cards.length > 1)
            SizedBox(
              height: 52,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                children: [
                  _FilterChip(
                    label: 'Todas',
                    selected: _selectedCardId == null,
                    onTap: () { setState(() => _selectedCardId = null); _load(); },
                  ),
                  ..._cards.map((c) => _FilterChip(
                    label: c.name,
                    selected: _selectedCardId == c.id,
                    onTap: () { setState(() => _selectedCardId = c.id); _load(); },
                  )),
                ],
              ),
            ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? Center(child: CircularProgressIndicator(color: colors.brand))
                : _error != null
                    ? Center(child: Text('No se pudieron cargar los clientes', style: TextStyle(color: colors.textMuted)))
                    : _filtered.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(32),
                              child: Column(mainAxisSize: MainAxisSize.min, children: [
                                Container(
                                  width: 64,
                                  height: 64,
                                  decoration: BoxDecoration(shape: BoxShape.circle, color: colors.brandSoft),
                                  child: Icon(Icons.people_outline_rounded, size: 30, color: colors.brand),
                                ),
                                const SizedBox(height: 14),
                                Text('Aún no hay clientes', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 16)),
                                const SizedBox(height: 4),
                                Text('Cuando alguien active tu tarjeta, aparecerá aquí.',
                                    textAlign: TextAlign.center, style: TextStyle(color: colors.textMuted)),
                              ]),
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            color: colors.brand,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
                              itemCount: _filtered.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 12),
                              itemBuilder: (_, i) => _CustomerTile(customer: _filtered[i]),
                            ),
                          ),
          ),
        ]),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: Material(
        color: selected ? colors.brand : colors.surface,
        shape: StadiumBorder(side: BorderSide(color: selected ? Colors.transparent : colors.border)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Center(
              child: Text(label,
                  style: TextStyle(color: selected ? colors.onBrand : colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 14)),
            ),
          ),
        ),
      ),
    );
  }
}

class _CustomerTile extends StatelessWidget {
  final CustomerModel customer;
  const _CustomerTile({required this.customer});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final pct = customer.stampsRequired > 0 ? customer.currentStamps / customer.stampsRequired : 0.0;
    final isReady = customer.currentStamps >= customer.stampsRequired;

    return AppCard(
      padding: const EdgeInsets.all(16),
      radius: 24,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          InitialAvatar(customer.customerName,
              background: isReady ? colors.sunSoft : colors.brandSoft, foreground: isReady ? colors.sun : colors.brand, size: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(customer.customerName,
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 15)),
              Text(customer.cardName, style: TextStyle(color: colors.textMuted, fontSize: 13)),
            ]),
          ),
          if (isReady)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(color: colors.sunSoft, borderRadius: BorderRadius.circular(999)),
              child: Text('Premio listo', style: TextStyle(color: colors.sun, fontSize: 12, fontWeight: FontWeight.w800)),
            )
          else
            Text('${customer.currentStamps}/${customer.stampsRequired}',
                style: displayStyle(size: 18, color: colors.brand)),
        ]),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: pct.clamp(0.0, 1.0),
            backgroundColor: colors.surfaceAlt,
            valueColor: AlwaysStoppedAnimation(isReady ? colors.sun : colors.brand),
            minHeight: 8,
          ),
        ),
        if (customer.timesCompleted > 0) ...[
          const SizedBox(height: 8),
          Text(
            '${customer.timesCompleted} canje${customer.timesCompleted != 1 ? 's' : ''} completados',
            style: TextStyle(color: colors.textMuted, fontSize: 12),
          ),
        ],
      ]),
    );
  }
}
