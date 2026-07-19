import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';

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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Clientes'),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh))],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TextField(
            controller: _search,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Buscar cliente...',
              hintStyle: const TextStyle(color: Color(0xFF64748B)),
              prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B)),
              filled: true,
              fillColor: const Color(0xFF1E293B),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),
        if (_cards.length > 1)
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
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
        const SizedBox(height: 8),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C896)))
              : _error != null
                  ? Center(
                      child: Text('Error: $_error',
                          style: const TextStyle(color: Color(0xFF94A3B8))),
                    )
                  : _filtered.isEmpty
                      ? const Center(
                          child: Text('Sin clientes',
                              style: TextStyle(color: Color(0xFF94A3B8))),
                        )
                      : RefreshIndicator(
                          onRefresh: _load,
                          color: const Color(0xFF00C896),
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                            itemCount: _filtered.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 8),
                            itemBuilder: (_, i) => _CustomerTile(customer: _filtered[i]),
                          ),
                        ),
        ),
      ]),
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
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF00C896) : const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.black : const Color(0xFF94A3B8),
            fontWeight: selected ? FontWeight.bold : FontWeight.normal,
            fontSize: 13,
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
    final pct = customer.stampsRequired > 0
        ? customer.currentStamps / customer.stampsRequired
        : 0.0;
    final isReady = customer.currentStamps >= customer.stampsRequired;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: isReady
            ? Border.all(color: const Color(0xFFF59E0B), width: 1.5)
            : null,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: const Color(0xFF0F172A),
            child: Text(
              customer.customerName[0].toUpperCase(),
              style: const TextStyle(
                  color: Color(0xFF00C896), fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(customer.customerName,
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold)),
              Text(customer.cardName,
                  style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
            ]),
          ),
          if (isReady)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text('🏆 Premio',
                  style: TextStyle(
                      color: Color(0xFFF59E0B),
                      fontSize: 11,
                      fontWeight: FontWeight.bold)),
            )
          else
            Text(
              '${customer.currentStamps}/${customer.stampsRequired}',
              style: const TextStyle(
                  color: Color(0xFF00C896), fontWeight: FontWeight.bold),
            ),
        ]),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct.clamp(0.0, 1.0),
            backgroundColor: const Color(0xFF0F172A),
            valueColor: AlwaysStoppedAnimation(
              isReady ? const Color(0xFFF59E0B) : const Color(0xFF00C896),
            ),
            minHeight: 6,
          ),
        ),
        if (customer.timesCompleted > 0) ...[
          const SizedBox(height: 6),
          Text(
            '${customer.timesCompleted} canje${customer.timesCompleted != 1 ? 's' : ''} completados',
            style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
          ),
        ],
      ]),
    );
  }
}
